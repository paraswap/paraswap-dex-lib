import { UniswapV2, UniswapV2Pair } from '../uniswap-v2';
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
import { getBigIntPow, getDexKeysWithNetwork } from '../../../utils';
import coneFactoryABI from '../../../abi/uniswap-v2/ConeFactory.json';
import conePairABI from '../../../abi/uniswap-v2/ConePair.json';
import _ from 'lodash';
import { NumberAsString, SwapSide } from 'paraswap-core';
import { ConeUniswapV2Pool } from './cone-uniswap-v2-pool';
import { ConeStablePool } from './cone-stable-pool';
import { Adapters, ConeConfig } from './config';
import { AbiCoder, Interface } from '@ethersproject/abi';

// to calculate prices for stable pool, we need decimals of the stable tokens
// so, we are extending UniswapV2PoolOrderedParams with token decimals
export interface ConePoolOrderedParams {
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

export interface ConePoolState {
  reserves0: string;
  reserves1: string;
  feeCode: number;
}

const iface = new Interface(conePairABI);
const coder = new AbiCoder();

export class Cone extends UniswapV2 {
  feeFactor = 0;
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(ConeConfig);

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    isDynamicFees = true,
    factoryAddress?: Address,
    subgraphURL?: string,
    initCode?: string,
    feeCode?: number,
    poolGasCost?: number,
    routerAddress?: Address,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      isDynamicFees,
      factoryAddress !== undefined
        ? factoryAddress
        : ConeConfig[dexKey][network].factoryAddress,
      subgraphURL === ''
        ? undefined
        : subgraphURL !== undefined
        ? subgraphURL
        : ConeConfig[dexKey][network].subgraphURL,
      initCode !== undefined ? initCode : ConeConfig[dexKey][network].initCode,
      feeCode !== undefined ? feeCode : ConeConfig[dexKey][network].feeCode,
      poolGasCost !== undefined
        ? poolGasCost
        : ConeConfig[dexKey][network].poolGasCost,
      iface,
      Adapters[network] || undefined,
    );

    this.factory = new dexHelper.web3Provider.eth.Contract(
      coneFactoryABI as any,
      factoryAddress !== undefined
        ? factoryAddress
        : ConeConfig[dexKey][network].factoryAddress,
    );

    this.router =
      routerAddress !== undefined
        ? routerAddress
        : ConeConfig[dexKey][network].router || '';
  }

  async findConePair(from: Token, to: Token, stable: boolean) {
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
      // Cone has additional boolean parameter "StablePool"
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
        const pair = await this.findConePair(_pair[0], _pair[1], stable);
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
    console.log('reserves', reserves);

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
  ): Promise<ConePoolState[]> {
    try {
      const multiCallFeeData = pairs.map(pair =>
        this.getFeesMultiCallData(pair.exchange!),
      );
      const calldata = pairs
        .map((pair, i) => {
          let calldata = [
            {
              target: pair.exchange,
              callData: iface.encodeFunctionData('getReserves', []),
            },
          ];
          calldata.push(multiCallFeeData[i]!.callEntry);
          return calldata;
        })
        .flat();

      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber);

      const returnData = _.chunk(data.returnData, 2);
      console.log('returnData', returnData);

      return pairs.map((pair, i) => {
        const reservesDecodedData = coder.decode(
          ['uint112', 'uint112', 'uint32'],
          returnData[i][0],
        );
        const feeCode = multiCallFeeData[i]!.callDecoder(returnData[i][1]);
        console.log('feeCode', feeCode);
        return {
          reserves0: reservesDecodedData[0].toString(),
          reserves1: reservesDecodedData[1].toString(),
          feeCode,
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
    priceParams: ConePoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    return priceParams.stable
      ? ConeStablePool.getSellPrice(priceParams, srcAmount)
      : ConeUniswapV2Pool.getSellPrice(priceParams, srcAmount);
  }

  async getBuyPrice(
    priceParams: ConePoolOrderedParams,
    srcAmount: bigint,
  ): Promise<bigint> {
    if (priceParams.stable) throw new Error(`Buy not supported`);
    return ConeUniswapV2Pool.getBuyPrice(priceParams, srcAmount);
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
    try {
      if (side === SwapSide.BUY) return null; // Buy side not implemented
      const from = this.dexHelper.config.wrapETH(_from);
      const to = this.dexHelper.config.wrapETH(_to);

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

        const pairParam = await this.getConePairOrderedParams(
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
      return resultPoolsFiltered.length > 0 ? resultPoolsFiltered : null;
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

  async getConePairOrderedParams(
    from: Token,
    to: Token,
    blockNumber: number,
    stable: boolean,
  ): Promise<ConePoolOrderedParams | null> {
    const pair = await this.findConePair(from, to, stable);
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

    const pairReversed =
      pair.token1.address.toLowerCase() === from.address.toLowerCase();
    if (pairReversed) {
      return {
        tokenIn: from.address,
        tokenOut: to.address,
        reservesIn: pairState.reserves1,
        reservesOut: pairState.reserves0,
        fee: pairState.feeCode.toString(),
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
      fee: pairState.feeCode.toString(),
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

    const from = this.dexHelper.config.wrapETH(_from);
    const to = this.dexHelper.config.wrapETH(_to);

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

  protected getFeesMultiCallData(poolAddress: Address) {
    const callEntry = {
      target: poolAddress,
      callData: iface.encodeFunctionData('swapFee', []),
    };
    const callDecoder = (values: any[]) => {
      const feeStr = iface
        .decodeFunctionResult('swapFee', values)[0]
        .toString();
      // fee in cone is denominator only (10_000 for stable and 2_000 for volatile pools
      return parseInt(feeStr);
    };
    return {
      callEntry,
      callDecoder,
    };
  }
}
