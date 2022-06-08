import { RESERVE_LIMIT, UniswapV2 } from '../uniswap-v2';
import { Network, NULL_ADDRESS, subgraphTimeout } from '../../../constants';
import {
  AdapterExchangeParam,
  Address,
  DexConfigMap,
  ExchangePrices,
  PoolLiquidity,
  SimpleExchangeParam,
  Token,
} from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import {
  DexParams,
  UniswapData,
  UniswapV2Data,
  UniswapV2PoolOrderedParams,
} from '../types';
import { getDexKeysWithNetwork, wrapETH } from '../../../utils';
import dystopiaFactoryABI from '../../../abi/uniswap-v2/DystFactory.json';
import { BI_MAX_UINT } from '../../../bigint-constants';
import _ from 'lodash';
import { NumberAsString, SwapSide } from 'paraswap-core';

export const DystopiaConfig: DexConfigMap<DexParams> = {
  Dystopia: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/dystopia-exchange/dystopia-v2',
      factoryAddress: '0x1d21Db6cde1b18c7E47B0F7F42f4b3F68b9beeC9',
      // ParaSwap-compatible Router with stable pools support
      router: '0x0E98A8e5ca6067B98d10Eb6476ec30E232346402',
      initCode:
        '0x009bce6d7eb00d3d075e5bd9851068137f44bba159f1cde806a268e20baaf2e8',
      feeCode: 5,
      poolGasCost: 350 * 1000, // TODO check swap max gas cost
    },
  },
};

export class Dystopia extends UniswapV2 {
  /// 0.05% swap fee
  private static SWAP_FEE_FACTOR: 2000n;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(DystopiaConfig);

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
      DystopiaConfig[dexKey][network].factoryAddress,
      DystopiaConfig[dexKey][network].subgraphURL,
      DystopiaConfig[dexKey][network].initCode,
      DystopiaConfig[dexKey][network].feeCode,
      DystopiaConfig[dexKey][network].poolGasCost,
    );

    this.factory = new dexHelper.web3Provider.eth.Contract(
      dystopiaFactoryABI as any,
      DystopiaConfig[dexKey][network].factoryAddress,
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

    let exchange = await this.factory.methods
      // Dystopia has additional boolean parameter "StablePool"
      // At this Dystopia implementation we're looking for
      // non-stable (uniswap2-like) pools only
      .getPair(token0.address, token1.address, false)
      .call();

    if (exchange === NULL_ADDRESS) {
      pair = { token0, token1 };
    } else {
      pair = { token0, token1, exchange };
    }
    this.pairs[key] = pair;
    return pair;
  }

  // Dystopia non-stable pools has almost same formula like uniswap2,
  // but little changed in contract.
  // So we repeat formulas here to have same output.
  async getSellPrice(
    priceParams: UniswapV2PoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    const { reservesIn, reservesOut } = priceParams;

    if (BigInt(reservesIn) + srcAmount > RESERVE_LIMIT) {
      return 0n;
    }

    const amountInWithFee = srcAmount - srcAmount / Dystopia.SWAP_FEE_FACTOR;

    const numerator = amountInWithFee * BigInt(reservesOut);

    const denominator =
      BigInt(reservesIn) * Dystopia.SWAP_FEE_FACTOR + amountInWithFee;

    return denominator === 0n ? 0n : numerator / denominator;
  }

  async getBuyPrice(
    priceParams: UniswapV2PoolOrderedParams,
    destAmount: bigint,
  ): Promise<bigint> {
    const { reservesIn, reservesOut } = priceParams;

    const numerator =
      BigInt(reservesIn) * destAmount * Dystopia.SWAP_FEE_FACTOR;
    const denominator =
      (Dystopia.SWAP_FEE_FACTOR - 1n) * (BigInt(reservesOut) - destAmount);

    if (denominator <= 0n) return BI_MAX_UINT;
    return 1n + numerator / denominator;
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.subgraphURL) return [];
    const query = `query ($token: Bytes!, $count: Int) {
      pools0: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token0: $token, reserve0_gt: 1, reserve1_gt: 1}) {
        id
        isStable
        token0 {
          id
          decimals
        }
        token1 {
          id
          decimals
        }
        reserveUSD
      }
      pools1: pairs(first: $count, orderBy: reserveUSD, orderDirection: desc, where: {token1: $token, reserve0_gt: 1, reserve1_gt: 1}) {
        id
        isStable
        token0 {
          id
          decimals
        }
        token1 {
          id
          decimals
        }
        reserveUSD
      }
    }`;

    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      {
        query,
        variables: { token: tokenAddress.toLowerCase(), count },
      },
      subgraphTimeout,
    );

    if (!(data && data.pools0 && data.pools1))
      throw new Error("Couldn't fetch the pools from the subgraph");
    const pools0 = _.map(data.pools0, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [
        {
          address: pool.token1.id.toLowerCase(),
          decimals: parseInt(pool.token1.decimals),
        },
      ],
      liquidityUSD: parseFloat(pool.reserveUSD),
    }));

    const pools1 = _.map(data.pools1, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [
        {
          address: pool.token0.id.toLowerCase(),
          decimals: parseInt(pool.token0.decimals),
        },
      ],
      liquidityUSD: parseFloat(pool.reserveUSD),
    }));

    return _.slice(
      _.sortBy(_.concat(pools0, pools1), [pool => -1 * pool.liquidityUSD]),
      0,
      count,
    );
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<UniswapV2Data>> {
    if (side === SwapSide.BUY) return null;
    return super.getPricesVolume(
      srcToken,
      destToken,
      amounts,
      side,
      blockNumber,
      limitPools,
    );
  }

  async getPoolIdentifiers(
    _from: Token,
    _to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (side === SwapSide.BUY) return [];

    const from = wrapETH(_from, this.network);
    const to = wrapETH(_to, this.network);

    if (from.address.toLowerCase() === to.address.toLowerCase()) {
      return [];
    }

    const tokenAddress = [from.address.toLowerCase(), to.address.toLowerCase()]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');

    const poolIdentifier = `${this.dexKey}_${tokenAddress}`;
    const poolIdentifierUniswap = poolIdentifier + '_u';
    const poolIdentifierStable = poolIdentifier + '_s';
    return [poolIdentifierUniswap, poolIdentifierStable];
  }

  async getSimpleParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);
    return super.getSimpleParam(src, dest, srcAmount, destAmount, data, side);
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    toAmount: NumberAsString, // required for buy case
    data: UniswapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);
    return super.getAdapterParam(
      srcToken,
      destToken,
      srcAmount,
      toAmount,
      data,
      side,
    );
  }
}
