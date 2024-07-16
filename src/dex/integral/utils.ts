import _ from 'lodash';
import { BytesLike } from 'ethers';
import { generalDecoder } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';
import { Address } from '@paraswap/core';
import { _require } from '../../utils';
import { FullMath } from '../uniswap-v3/contract-math/FullMath';
import { Oracle } from '../uniswap-v3/contract-math/Oracle';
import { TickMath } from '../uniswap-v3/contract-math/TickMath';
import { PoolState as UniswapPoolState } from '../uniswap-v3/types';
import { IntegralContext } from './context';
import { PoolStates, RelayerPoolState } from './types';

export function ceil_div(a: bigint, b: bigint) {
  const c = a / b;
  if (a != b * c) {
    return c + 1n;
  } else {
    return c;
  }
}

export const uint32ToNumber = (
  result: MultiResult<BytesLike> | BytesLike,
): number => {
  return generalDecoder(result, ['uint32'], 0, value =>
    parseInt(value[0].toString(), 10),
  );
};

export function sortTokens(srcAddress: Address, destAddress: Address) {
  return [srcAddress, destAddress].sort((a, b) => (a < b ? -1 : 1));
}

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

export function getPoolBackReferencedFrom(
  context: IntegralContext,
  poolAddress: Address,
) {
  return Object.entries(context.pools).find(
    ([, pool]) => pool.base?.poolAddress === poolAddress,
  );
}
