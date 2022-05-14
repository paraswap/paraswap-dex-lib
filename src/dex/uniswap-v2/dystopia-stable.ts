import {
  UniswapV2,
  UniswapV2PoolOrderedParams,
  RESERVE_LIMIT,
  TOKEN_EXTRA_FEE,
} from './uniswap-v2';
import { Network, NULL_ADDRESS } from '../../constants';
import {
  Address,
  DexConfigMap,
  ExchangePrices,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { IDexHelper } from '../../dex-helper';
import {
  DexParams,
  UniswapData,
  UniswapV2Data,
  UniswapV2Functions,
} from './types';
import { getBigIntPow, getDexKeysWithNetwork, wrapETH } from '../../utils';
import dystopiaFactoryABI from '../../abi/dystopia/DystFactory.json';
import { BI_MAX_UINT } from '../../bigint-constants';
import { DystopiaConfig, DystopiaSharedPolygonConfig } from './dystopia';
import { NumberAsString, SwapSide } from 'paraswap-core';

export const DystopiaStableConfig: DexConfigMap<DexParams> = {
  DystopiaStable: {
    [Network.POLYGON]: DystopiaSharedPolygonConfig,
  },
};

// to calculate prices for stable pool, we need decimals of the stable tokens
// so, we are extending UniswapV2PoolOrderedParams with token decimals
interface UniswapV2PoolOrderedParamsWithDecimals {
  tokenIn: string;
  tokenOut: string;
  reservesIn: string;
  reservesOut: string;
  fee: string;
  direction: boolean;
  exchange: string;
  decimalsIn: number;
  decimalsOut: number;
}

const e18: bigint = BigInt(1e18);

function _k(
  x: bigint,
  y: bigint,
  decimals0: bigint,
  decimals1: bigint,
): bigint {
  const _x = (x * e18) / decimals0;
  const _y = (y * e18) / decimals1;
  const _a = (_x * _y) / e18;
  const _b = (_x * _x) / e18 + (_y * _y) / e18;
  // x3y+y3x >= k
  return (_a * _b) / e18;
}

function _f(x0: bigint, y: bigint): bigint {
  return (
    (x0 * ((((y * y) / e18) * y) / e18)) / e18 +
    (((((x0 * x0) / e18) * x0) / e18) * y) / e18
  );
}

function _d(x0: bigint, y: bigint): bigint {
  return (3n * x0 * ((y * y) / e18)) / e18 + (((x0 * x0) / e18) * x0) / e18;
}

function _getY(x0: bigint, xy: bigint, y: bigint): bigint {
  for (let i = 0; i < 255; i++) {
    const yPrev = y;
    const k = _f(x0, y);
    if (k < xy) {
      const dy = ((xy - k) * e18) / _d(x0, y);
      y = y + dy;
    } else {
      const dy = ((k - xy) * e18) / _d(x0, y);
      y = y - dy;
    }
    if (_closeTo(y, yPrev, 1n)) {
      break;
    }
  }
  return y;
}

function _closeTo(a: bigint, b: bigint, target: bigint) {
  if (a > b) {
    if (a - b <= target) {
      return true;
    }
  } else {
    if (b - a <= target) {
      return true;
    }
  }
  return false;
}

export class DystopiaStable extends UniswapV2 {
  /// 0.05% swap fee
  private static SWAP_FEE_FACTOR: bigint = BigInt(2000);

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(DystopiaStableConfig);

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      false,
      DystopiaStableConfig[dexKey][network].factoryAddress,
      DystopiaStableConfig[dexKey][network].subgraphURL,
      DystopiaStableConfig[dexKey][network].initCode,
      DystopiaStableConfig[dexKey][network].feeCode,
      DystopiaStableConfig[dexKey][network].poolGasCost,
    );

    // swaps on Dystopia should use own router
    const router = DystopiaStableConfig[dexKey][network].router;
    if (router) this.router = router;

    this.factory = new dexHelper.web3Provider.eth.Contract(
      dystopiaFactoryABI as any,
      DystopiaStableConfig[dexKey][network].factoryAddress,
    );
  }

  async findPair(from: Token, to: Token) {
    if (from.address.toLowerCase() === to.address.toLowerCase()) return null;
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}`;
    let pair = this.pairs[key];
    if (pair) return pair;
    // try to find non-stable pair first
    let exchange = await this.factory.methods
      // Dystopia has additional boolean parameter "StablePool"
      // At this DystopiaStable implementation we're looking for
      // stable (x3y+y3x) pools only
      .getPair(token0.address, token1.address, true)
      .call();

    if (exchange === NULL_ADDRESS) {
      pair = { token0, token1 };
    } else {
      pair = { token0, token1, exchange };
    }
    this.pairs[key] = pair;
    return pair;
  }

  async getSellPrice(
    priceParams: UniswapV2PoolOrderedParamsWithDecimals,
    srcAmount: bigint,
  ): Promise<bigint> {
    console.log('srcAmount   ', srcAmount);
    const { reservesIn, reservesOut, decimalsIn, decimalsOut } = priceParams;

    if (BigInt(reservesIn) + srcAmount > RESERVE_LIMIT) {
      return 0n;
    }

    const amountIn = srcAmount - srcAmount / DystopiaStable.SWAP_FEE_FACTOR;

    const reservesInN = BigInt(reservesIn);
    const reservesOutN = BigInt(reservesOut);
    const decimalsInN = BigInt(decimalsIn);
    const decimalsOutN = BigInt(decimalsOut);

    const xy = _k(reservesInN, reservesOutN, decimalsInN, decimalsOutN);
    const reserveA = (reservesInN * e18) / decimalsInN;
    const reserveB = (reservesOutN * e18) / decimalsOutN;
    const amountInNorm = (amountIn * e18) / decimalsInN;
    const y = reserveB - _getY(amountInNorm + reserveA, xy, reserveB);
    const returnAmount = (y * decimalsOutN) / e18;
    console.log('returnAmount', returnAmount);
    return returnAmount;
  }

  // TODO
  async getBuyPrice(
    priceParams: UniswapV2PoolOrderedParamsWithDecimals,
    destAmount: bigint,
  ): Promise<bigint> {
    const { reservesIn, reservesOut } = priceParams;

    const numerator =
      BigInt(reservesIn) * destAmount * DystopiaStable.SWAP_FEE_FACTOR;
    const denominator =
      (DystopiaStable.SWAP_FEE_FACTOR - 1n) *
      (BigInt(reservesOut) - destAmount);

    if (denominator <= 0n) return BI_MAX_UINT;
    return 1n + numerator / denominator;
  }

  async getBuyPricePath(
    amount: bigint,
    params: UniswapV2PoolOrderedParamsWithDecimals[],
  ): Promise<bigint> {
    let price = amount;
    for (const param of params.reverse()) {
      price = await this.getBuyPrice(param, price);
    }
    return price;
  }

  async getSellPricePath(
    amount: bigint,
    params: UniswapV2PoolOrderedParamsWithDecimals[],
  ): Promise<bigint> {
    let price = amount;
    for (const param of params) {
      price = await this.getSellPrice(param, price);
    }
    return price;
  }

  // Same as at uniswap-v2-pool.json, but extended with decimals
  async getPairOrderedParams(
    from: Token,
    to: Token,
    blockNumber: number,
  ): Promise<UniswapV2PoolOrderedParamsWithDecimals | null> {
    const params = await super.getPairOrderedParams(from, to, blockNumber);
    if (!params) return null;

    return {
      ...params,
      decimalsIn: from.decimals,
      decimalsOut: to.decimals,
    };
  }
}
