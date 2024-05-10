import _ from 'lodash';
import { Address } from '../../types';
import { _require } from '../../utils';
import { FullMath } from '../uniswap-v3/contract-math/FullMath';
import { Oracle } from '../uniswap-v3/contract-math/Oracle';
import { TickMath } from '../uniswap-v3/contract-math/TickMath';
import { PoolState as UniswapPoolState } from '../uniswap-v3/types';
import { IntegralContext } from './context';
import { PoolStates, RelayerPoolState, RelayerState } from './types';
import { sortTokens } from './utils';

export function getDecimalsConverter(
  decimals0: number,
  decimals1: number,
  inverted: boolean,
) {
  return (
    10n **
    (18n + BigInt(inverted ? decimals1 - decimals0 : decimals0 - decimals1))
  );
}

export function getPrice(states: PoolStates, inverted: boolean) {
  const { base, pricing, relayer } = states;
  const decimalsConverter = getDecimalsConverter(
    base.decimals0,
    base.decimals1,
    false,
  );
  const spotPrice = getSpotPrice(pricing, decimalsConverter);
  const averagePrice = getAveragePrice(relayer, pricing, decimalsConverter);
  if (inverted) {
    return 10n ** 36n / (spotPrice > averagePrice ? spotPrice : averagePrice);
  } else {
    return spotPrice < averagePrice ? spotPrice : averagePrice;
  }
}

export function getSpotPrice(
  pricing: UniswapPoolState,
  decimalsConverter: bigint,
) {
  const sqrtPriceX96 = pricing.slot0.sqrtPriceX96;
  const priceX128 = FullMath.mulDiv(sqrtPriceX96, sqrtPriceX96, 2n ** 64n);
  return FullMath.mulDiv(priceX128, decimalsConverter, 2n ** 128n);
}

export function getAveragePrice(
  relayer: RelayerPoolState,
  pricing: UniswapPoolState,
  decimalsConverter: bigint,
) {
  _require(relayer.twapInterval > 0, 'Twap Interval not set');
  const secondsAgo = BigInt(relayer.twapInterval);
  const secondsAgos = [secondsAgo, 0n];
  const tickCumulatives = getTickCumulatives(pricing, secondsAgos);

  const delta = tickCumulatives[1] - tickCumulatives[0];
  let arithmeticMeanTick = delta / secondsAgo;
  if (delta < 0 && delta % secondsAgo != 0n) {
    --arithmeticMeanTick;
  }

  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(arithmeticMeanTick);
  const ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 2n ** 64n);
  return FullMath.mulDiv(ratioX128, decimalsConverter, 2n ** 128n);
}

export function getTickCumulatives(
  poolState: UniswapPoolState,
  secondsAgos: bigint[],
) {
  const { tickCumulatives } = secondsAgos.reduce(
    (memo, secondsAgo, i) => {
      [memo.tickCumulatives[i], memo.secondsPerLiquidityCumulativeX128s[i]] =
        Oracle.observeSingle(
          poolState,
          BigInt.asUintN(32, poolState.blockTimestamp),
          secondsAgo,
          poolState.slot0.tick,
          poolState.slot0.observationIndex,
          poolState.liquidity,
          poolState.slot0.observationCardinality,
        );
      return memo;
    },
    {
      tickCumulatives: Array<bigint>(secondsAgos.length),
      secondsPerLiquidityCumulativeX128s: Array<bigint>(secondsAgos.length),
    },
  );

  return tickCumulatives;
}

export function isInverted(tokenIn: Address, tokenOut: Address) {
  const [, token1] =
    tokenIn.toLowerCase() < tokenOut.toLowerCase()
      ? [tokenIn, tokenOut]
      : [tokenOut, tokenIn];
  return tokenIn === token1;
}

export function getPoolIdentifier(
  dexKey: string,
  srcAddress: Address,
  destAddress: Address,
) {
  const tokenAddresses = sortTokens(
    srcAddress.toLowerCase(),
    destAddress.toLowerCase(),
  ).join('_');
  return `${dexKey}_${tokenAddresses}`;
}

export async function onPoolSwapForRelayer(
  blockNumber: number,
  poolAddress: Address,
  recipient: Address,
  amount0Out: bigint,
  amount1Out: bigint,
  _context?: IntegralContext,
) {
  const context = _context || IntegralContext.getInstance();
  if (recipient.toLowerCase() === context.relayerAddress.toLowerCase()) {
    const pools = context.relayer.getPools();
    if (pools[poolAddress.toLowerCase()]) {
      const token0 = pools[poolAddress.toLowerCase()].token0;
      const token1 = pools[poolAddress.toLowerCase()].token1;

      let _state = context.relayer.getStaleState();
      if (!_state) {
        _state = await context.relayer.generateState(blockNumber);
        context.relayer.setState(_state, blockNumber);
        return;
      } else {
        blockNumber = context.relayer.getStateBlockNumber();
      }

      const state: RelayerState = _.cloneDeep(_state);
      if (amount1Out > 0n) {
        state.tokens[token1].balance += amount1Out;
      } else {
        state.tokens[token0].balance += amount0Out;
      }
      context.relayer.setState(state, blockNumber);
    } else {
      context.logger.error(
        'Integral Relayer: Pool address not found for',
        poolAddress,
      );
    }
  }
}

function getPoolBackReferencedFrom(
  context: IntegralContext,
  poolAddress: Address,
) {
  return Object.entries(context.pools).find(
    ([, pool]) => pool.base?.poolAddress === poolAddress,
  );
}

export async function onRelayerPoolEnabledSet(
  poolAddress: Address,
  state: RelayerPoolState,
  blockNumber: number,
) {
  const context = IntegralContext.getInstance();
  const poolEntry = getPoolBackReferencedFrom(context, poolAddress);
  if (state.isEnabled && (!poolEntry || !poolEntry[1].enabled)) {
    const _factoryState = context.factory.getStaleState();
    const factoryState = _factoryState
      ? _factoryState
      : await context.factory.generateState(blockNumber);
    const { token0, token1 } = factoryState.pools[poolAddress];
    await context.addPools({ [poolAddress]: { token0, token1 } }, blockNumber);
  } else if (!state.isEnabled && poolEntry && poolEntry[1].enabled) {
    context.pools[poolEntry[0]].enabled = false;
  }
}

export function onRebalanceSellOrderExecuted(
  blockNumber: number,
  orderId: bigint,
) {
  const context = IntegralContext.getInstance();
  context.relayer.executeOrder(orderId, blockNumber);
}

export async function onPoolCreatedAddPool(
  token0: Address,
  token1: Address,
  poolAddress: Address,
  blockNumber: number,
) {
  const context = IntegralContext.getInstance();
  await context.addPools({ [poolAddress]: { token0, token1 } }, blockNumber);
}

export async function onTransferUpdateBalance(
  token: Address,
  from: Address,
  to: Address,
  amount: bigint,
  blockNumber: number,
  _context?: IntegralContext,
) {
  const context = _context || IntegralContext.getInstance();
  let _state = context.relayer.getStaleState();
  if (!_state) {
    context.logger.error('Integral Token: Relayer stale state not found');
    return;
  }
  const state: RelayerState = _.cloneDeep(_state);
  if (context.relayer.relayerAddress.toLowerCase() === from) {
    state.tokens[token].balance -= amount;
  } else if (context.relayer.relayerAddress.toLowerCase() === to) {
    state.tokens[token].balance += amount;
  }
  context.relayer.setState(state, blockNumber);
}
