import { AsyncOrSync } from 'ts-essentials';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  Logger,
  PoolLiquidity,
  PoolPrices,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { Network, NULL_ADDRESS, SUBGRAPH_TIMEOUT } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  ReservoirData,
  ReservoirPoolState,
  ReservoirPoolTypes,
  ReservoirSwapFunctions,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, ReservoirConfig } from './config';
import { ReservoirEventPool } from './reservoir-pool';
import GenericFactoryABI from '../../abi/reservoir/GenericFactory.json';
import ReservoirRouterABI from '../../abi/reservoir/ReservoirRouter.json';
import { Contract } from '@ethersproject/contracts';
import { AbiCoder, Interface } from '@ethersproject/abi';
import _ from 'lodash';
import { SwapSide } from '@paraswap/core';

export interface ReservoirPair {
  token0: Token;
  token1: Token;
  exchange?: Address;
  pool?: ReservoirEventPool;
}

const coder = new AbiCoder();

export class Reservoir extends SimpleExchange implements IDex<ReservoirData> {
  readonly hasConstantPriceLargeAmounts = false;

  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(ReservoirConfig);

  logger: Logger;

  reservoirRouterInterface: Interface;

  factory: Contract;

  pairs: { [key: string]: ReservoirPair } = {};

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    readonly factoryAddress: Address = ReservoirConfig[dexKey][network].factory,
    readonly subgraphURL: string | undefined = ReservoirConfig[dexKey] &&
      ReservoirConfig[dexKey][network].subgraphURL,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
    protected router: Address = ReservoirConfig[dexKey][network].router,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.factory = new Contract(factoryAddress, GenericFactoryABI);
    this.reservoirRouterInterface = new Interface(ReservoirRouterABI);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const from = this.dexHelper.config.wrapETH(srcToken);
    const to = this.dexHelper.config.wrapETH(destToken);

    if (from.address.toLowerCase() === to.address.toLowerCase()) {
      return [];
    }

    // do I add the curveId in the identifier?
    const tokenAddresses = [
      from.address.toLowerCase(),
      to.address.toLowerCase(),
    ]
      .sort((a, b) => (a > b ? 1 : -1))
      .join('_');

    const poolIdentifier = `${this.dexKey}_${tokenAddresses}`;

    return [poolIdentifier];
  }

  // adds the pair into the class variable for use in routing
  async addPair(
    pair: ReservoirPair,
    reserve0: string,
    reserve1: string,
    curveId: ReservoirPoolTypes,
    blockNumber: number,
  ): Promise<void> {
    pair.pool = new ReservoirEventPool(
      this.dexKey,
      this.dexHelper,
      pair.exchange!,
      pair.token0,
      pair.token1,
      curveId,
      this.logger,
    );
    pair.pool.addressesSubscribed.push(pair.exchange!);

    await pair.pool.initialize(blockNumber, {
      state: { reserve0, reserve1, curveId, swapFee: 0n, ampCoefficient: 0n },
    });
  }

  async findPair(
    from: Token,
    to: Token,
    curveId: ReservoirPoolTypes,
  ): Promise<ReservoirPair | null> {
    if (from.address.toLowerCase() == to.address.toLowerCase()) return null;
    const [token0, token1] =
      from.address.toLowerCase() < to.address.toLowerCase()
        ? [from, to]
        : [to, from];

    const key = `${token0.address.toLowerCase()}-${token1.address.toLowerCase()}-${curveId}`;
    let pair = this.pairs[key];
    if (pair) return pair;
    const exchange = await this.factory.methods
      .getPair(token0.address, token1.address, curveId)
      .call();

    if (exchange === NULL_ADDRESS) {
      pair = { token0, token1 };
    } else {
      pair = { token0, token1, exchange };
    }

    this.pairs[key] = pair;
    return pair;
  }

  async getManyPoolReserves(
    pairs: ReservoirPair[],
    blockNumber: number,
  ): Promise<ReservoirPoolState[]> {
    try {
      const calldata = pairs
        .map((pair, i) => {
          let calldata = [
            {
              target: pair.exchange,
            },
          ];
        })
        .flat();

      const data: { returnData: any[] } =
        await this.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber);

      const returnData = _.chunk(data.returnData);

      return pairs.map((pair, i) => ({
        reserve0: coder.decode(['uint104'], returnData[i][0])[0].toString(),
        reserve1: coder.decode(['uint104'], returnData[i][1])[0].toString(),
        curveId: 0,
        swapFee: 0n,
        ampCoefficient: null,
      }));
    } catch (e) {
      this.logger.error(
        `Error_getManyPoolReserves could not get reserves with error:`,
        e,
      );
      return [];
    }
  }

  async batchCatchUpPairs(
    pairs: [Token, Token][],
    blockNumber: number,
  ): Promise<void> {
    if (!blockNumber) return;

    const pairsToFetch: ReservoirPair[] = [];
    // TODO: optimize this into parallel promises instead of blocking in a loop
    for (const _pair of pairs) {
      const pair = await this.findPair(_pair[0], _pair[1], 0);
      if (!(pair && pair.exchange)) continue;
      if (!pair.pool) {
        pairsToFetch.push(pair);
      } else if (!pair.pool.getState(blockNumber)) {
        pairsToFetch.push(pair);
      }
    }
    // for the stable curve
    for (const _pair of pairs) {
      const pair = await this.findPair(_pair[0], _pair[1], 1);
      if (!(pair && pair.exchange)) continue;
      if (!pair.pool) {
        pairsToFetch.push(pair);
      } else if (!pair.pool.getState(blockNumber)) {
        pairsToFetch.push(pair);
      }
    }

    if (!pairsToFetch.length) return;

    const reserves = await this.getManyPoolReserves(pairsToFetch, blockNumber);

    if (reserves.length !== pairsToFetch.length) {
      this.logger.error(
        `Error_getManyPoolReserves didn't get any pool reserves`,
      );
    }
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<ReservoirData>> {
    try {
      const from = this.dexHelper.config.wrapETH(srcToken);
      const to = this.dexHelper.config.wrapETH(destToken);
      if (from.address.toLowerCase() === to.address.toLowerCase()) {
        return null;
      }

      const tokenAddresses = [
        from.address.toLowerCase(),
        to.address.toLowerCase(),
      ]
        .sort((a, b) => (a > b ? 1 : -1))
        .join('_'); // not sure what this underscore is for, or if we even need it

      const poolIdentifier = `${this.dexKey}_${tokenAddresses}`;

      if (limitPools && limitPools.every(p => p !== poolIdentifier)) {
        return null;
      }

      await this.batchCatchUpPairs([[from, to]], blockNumber);

      const isSell = side === SwapSide.SELL;

      // TODO: placeholder for now
      return null;
    } catch (e) {
      this.logger.error('Reservoir_getPricesVolume', e);
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<ReservoirData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: ReservoirData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: data.router,
      payload,
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: ReservoirData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side == SwapSide.SELL
        ? ReservoirSwapFunctions.exactInput
        : ReservoirSwapFunctions.exactOutput;

    // Encode here the transaction arguments
    const swapData = this.reservoirRouterInterface.encodeFunctionData(
      swapFunction,
      // doesn't consider the multi hop at the moment?
      // we don't calculate the slippage here ourselves?
      [
        srcAmount,
        destAmount,
        srcToken,
        destToken,
        data.curveIds,
        data.recipient,
      ],
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.router,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    // TODO: complete me!
    // low priority as it is optional
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.subgraphURL) return [];
    // query graphQL and return pools with that particular token
    const query = `
      query TopPools ($token: String!) { 
        Pairs(filter: { OR: [{token0: $token}, {token1: $token} ]}) {
          address
          swapFee
          curveId
          tvlUSD
          token0
          token1
          token0Decimals
          token1Decimals
        } 
      }`;

    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      {
        variables: { token: tokenAddress },
      },
      SUBGRAPH_TIMEOUT,
    );

    // TODO: need to sort by tvlUSD
    // Not possible to do with graphQL for now cuz we're not indexing things I think
    // need to change the endpoint with robo's support to achieve this

    // console.log('data', data);

    // return all pools with the query as there is no need to do further processing
    // cuz it is impossible to have overlaps

    return data;
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}
}
