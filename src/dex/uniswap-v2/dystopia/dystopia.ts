import { TOKEN_EXTRA_FEE, UniswapV2, UniswapV2Pair } from '../uniswap-v2';
import { Network, NULL_ADDRESS, SUBGRAPH_TIMEOUT } from '../../../constants';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  PoolLiquidity,
  SimpleExchangeParam,
  Token,
} from '../../../types';
import { IDexHelper } from '../../../dex-helper';
import { UniswapData, UniswapV2Data } from '../types';
import { getBigIntPow, getDexKeysWithNetwork, wrapETH } from '../../../utils';
import dystopiaFactoryABI from '../../../abi/uniswap-v2/DystFactory.json';
import dystPairABI from '../../../abi/uniswap-v2/DystPair.json';
import _ from 'lodash';
import { NumberAsString, SwapSide } from 'paraswap-core';
import { DystopiaUniswapV2Pool } from './dystopia-uniswap-v2-pool';
import { DystopiaStablePool } from './dystopia-stable-pool';
import { Adapters, DystopiaConfig } from './config';
import { AbiCoder, Interface } from '@ethersproject/abi';

// to calculate prices for stable pool, we need decimals of the stable tokens
// so, we are extending UniswapV2PoolOrderedParams with token decimals
export interface DystopiaPoolOrderedParams {
  tokenIn: string;
  tokenOut: string;
  reservesIn: string;
  reservesOut: string;
  fee: string;
  direction: boolean;
  exchange: string;
  decimalsIn: number;
  decimalsOut: number;
  stable: boolean;
}

export interface DystopiaPoolState {
  reserves0: string;
  reserves1: string;
  feeCode: number;
}

const iface = new Interface(dystPairABI);
const coder = new AbiCoder();

export class Dystopia extends UniswapV2 {
  feeFactor = 20000;
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
      dystPairABI,
      Adapters[network] || undefined,
    );

    this.factory = new dexHelper.web3Provider.eth.Contract(
      dystopiaFactoryABI as any,
      DystopiaConfig[dexKey][network].factoryAddress,
    );

    this.router = DystopiaConfig[dexKey][network].router || '';
  }

  async findDystopiaPair(from: Token, to: Token, stable: boolean) {
    if (from.address.toLowerCase() === to.address.toLowerCase()) return null;
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    const typePostfix = this.poolPostfix(stable);
    const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}-${typePostfix}`;
    let pair = this.pairs[key];
    if (pair) return pair;

    let exchange = await this.factory.methods
      // Dystopia has additional boolean parameter "StablePool"
      // At first we look for uniswap-like volatile pool
      .getPair(token0.address, token1.address, stable)
      .call();

    if (exchange === NULL_ADDRESS) {
      pair = { token0, token1 };
    } else {
      pair = { token0, token1, exchange };
    }
    this.pairs[key] = pair;
    return pair;
  }

  async batchCatchUpPairs(pairs: [Token, Token][], blockNumber: number) {
    if (!blockNumber) return;
    const pairsToFetch: UniswapV2Pair[] = [];
    for (const _pair of pairs) {
      for (const stable of [false, true]) {
        const pair = await this.findDystopiaPair(_pair[0], _pair[1], stable);
        if (!(pair && pair.exchange)) continue;
        if (!pair.pool) {
          pairsToFetch.push(pair);
        } else if (!pair.pool.getState(blockNumber)) {
          pairsToFetch.push(pair);
        }
      }
    }

    if (!pairsToFetch.length) return;

    const reserves = await this.getManyPoolReserves(pairsToFetch, blockNumber);

    if (reserves.length !== pairsToFetch.length) {
      this.logger.error(
        `Error_getManyPoolReserves didn't get any pool reserves`,
      );
    }

    for (let i = 0; i < pairsToFetch.length; i++) {
      const pairState = reserves[i];
      const pair = pairsToFetch[i];
      if (!pair.pool) {
        await this.addPool(
          pair,
          pairState.reserves0,
          pairState.reserves1,
          pairState.feeCode,
          blockNumber,
        );
      } else pair.pool.setState(pairState, blockNumber);
    }
  }

  async getManyPoolReserves(
    pairs: UniswapV2Pair[],
    blockNumber: number,
  ): Promise<DystopiaPoolState[]> {
    try {
      const calldata = pairs
        .map(pair => {
          return [
            {
              target: pair.exchange,
              callData: iface.encodeFunctionData('getReserves', []),
            },
          ];
        })
        .flat();

      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber);

      return pairs.map((pair, i) => {
        const decodedData = coder.decode(
          ['uint112', 'uint112', 'uint32'],
          data.returnData[i],
        );

        return {
          reserves0: decodedData[0].toString(),
          reserves1: decodedData[1].toString(),
          feeCode: this.feeCode,
        };
      });
    } catch (e) {
      this.logger.error(
        `Error_getManyPoolReserves could not get reserves with error:`,
        e,
      );
      return [];
    }
  }

  async getSellPrice(
    priceParams: DystopiaPoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    return priceParams.stable
      ? DystopiaStablePool.getSellPrice(priceParams, srcAmount)
      : DystopiaUniswapV2Pool.getSellPrice(priceParams, srcAmount);
  }

  async getBuyPrice(
    priceParams: DystopiaPoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    if (priceParams.stable) throw new Error(`Buy not supported`);
    return DystopiaUniswapV2Pool.getBuyPrice(priceParams, srcAmount);
  }

  async getPricesVolume(
    _from: Token,
    _to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    // list of pool identifiers to use for pricing, if undefined use all pools
    limitPools?: string[],
  ): Promise<ExchangePrices<UniswapV2Data> | null> {
    this.logger.trace(`${this.dexKey}: getPricesVolume limitPools`, limitPools);
    try {
      if (side === SwapSide.BUY) return null; // Buy side not implemented yet
      const from = wrapETH(_from, this.network);
      const to = wrapETH(_to, this.network);

      if (from.address.toLowerCase() === to.address.toLowerCase()) {
        return null;
      }

      const tokenAddress = [
        from.address.toLowerCase(),
        to.address.toLowerCase(),
      ]
        .sort((a, b) => (a > b ? 1 : -1))
        .join('_');

      await this.batchCatchUpPairs([[from, to]], blockNumber);

      const resultPromises = [false, true].map(async stable => {
        const poolIdentifier =
          `${this.dexKey}_${tokenAddress}` + this.poolPostfix(stable);

        if (limitPools && limitPools.every(p => p !== poolIdentifier))
          return null;

        const pairParam = await this.getDystopiaPairOrderedParams(
          from,
          to,
          blockNumber,
          stable,
        );

        if (!pairParam) return null;

        const unitAmount = getBigIntPow(
          // @ts-expect-error Buy side is not implemented yet
          side === SwapSide.BUY ? to.decimals : from.decimals,
        );
        const unit =
          // @ts-expect-error Buy side is not implemented yet
          side === SwapSide.BUY
            ? await this.getBuyPricePath(unitAmount, [pairParam])
            : await this.getSellPricePath(unitAmount, [pairParam]);

        const prices =
          // @ts-expect-error Buy side is not implemented yet
          side === SwapSide.BUY
            ? await Promise.all(
                amounts.map(amount =>
                  this.getBuyPricePath(amount, [pairParam]),
                ),
              )
            : await Promise.all(
                amounts.map(amount =>
                  this.getSellPricePath(amount, [pairParam]),
                ),
              );

        return {
          prices: prices,
          unit: unit,
          data: {
            router: this.router,
            path: [from.address.toLowerCase(), to.address.toLowerCase()],
            factory: this.factoryAddress,
            initCode: this.initCode,
            feeFactor: this.feeFactor,
            pools: [
              {
                address: pairParam.exchange,
                fee: parseInt(pairParam.fee),
                direction: pairParam.direction,
              },
            ],
          },
          exchange: this.dexKey,
          poolIdentifier,
          gasCost: this.poolGasCost,
          poolAddresses: [pairParam.exchange],
        };
      });

      const resultPools = (await Promise.all(
        resultPromises,
      )) as ExchangePrices<UniswapV2Data>;
      const resultPoolsFiltered = resultPools.filter(item => !!item); // filter null elements
      const resultPoolsSorted = resultPoolsFiltered.sort((a, b) =>
        Number(b.unit - a.unit),
      );
      this.logger.trace(`${this.dexKey}: resultPoolsSorted`, resultPoolsSorted);
      return resultPoolsSorted.length > 0 ? resultPoolsSorted : null;
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `Error_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`Error_getPrices:`, e);
      return null;
    }
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
      SUBGRAPH_TIMEOUT,
    );

    if (!(data && data.pools0 && data.pools1))
      throw new Error("Couldn't fetch the pools from the subgraph");
    const pools0 = _.map(data.pools0, pool => ({
      exchange: this.dexKey,
      stable: pool.isStable,
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
      stable: pool.isStable,
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

  // Same as at uniswap-v2-pool.json, but extended with decimals and stable

  async getDystopiaPairOrderedParams(
    from: Token,
    to: Token,
    blockNumber: number,
    stable: boolean,
  ): Promise<DystopiaPoolOrderedParams | null> {
    const pair = await this.findDystopiaPair(from, to, stable);
    if (!(pair && pair.pool && pair.exchange)) return null;
    const pairState = pair.pool.getState(blockNumber);
    if (!pairState) {
      this.logger.error(
        `Error_orderPairParams expected reserves, got none (maybe the pool doesn't exist) ${
          from.symbol || from.address
        } ${to.symbol || to.address}`,
      );
      return null;
    }
    const fee = (
      pairState.feeCode + (TOKEN_EXTRA_FEE[from.address.toLowerCase()] || 0)
    ).toString();
    const pairReversed =
      pair.token1.address.toLowerCase() === from.address.toLowerCase();
    if (pairReversed) {
      return {
        tokenIn: from.address,
        tokenOut: to.address,
        reservesIn: pairState.reserves1,
        reservesOut: pairState.reserves0,
        fee,
        direction: false,
        exchange: pair.exchange,
        decimalsIn: from.decimals,
        decimalsOut: to.decimals,
        stable,
      };
    }
    return {
      tokenIn: from.address,
      tokenOut: to.address,
      reservesIn: pairState.reserves0,
      reservesOut: pairState.reserves1,
      fee,
      direction: true,
      exchange: pair.exchange,
      decimalsIn: from.decimals,
      decimalsOut: to.decimals,
      stable,
    };
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
    const poolIdentifierUniswap = poolIdentifier + this.poolPostfix(false);
    const poolIdentifierStable = poolIdentifier + this.poolPostfix(true);
    return [poolIdentifierUniswap, poolIdentifierStable];
  }

  poolPostfix(stable: boolean) {
    return stable ? 'S' : 'U';
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
