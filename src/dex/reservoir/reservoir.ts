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
  TransferFeeParams,
} from '../../types';
import {
  DEST_TOKEN_DEX_TRANSFERS,
  DEST_TOKEN_PARASWAP_TRANSFERS,
  Network,
  NULL_ADDRESS,
  SRC_TOKEN_PARASWAP_TRANSFERS,
  SUBGRAPH_TIMEOUT,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  ReservoirData,
  ReservoirOrderedParams,
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
import { applyTransferFee } from '../../lib/token-transfer-fee';
import { ReservoirStablePool } from './reservoir-stable-pool';
import { ReservoirConstantProductPool } from './reservoir-constant-product-pool';

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
      // iterate over all curves
      for (let i = 0; i < Object.keys(ReservoirPoolTypes).length / 2; ++i) {
        const pair = await this.findPair(_pair[0], _pair[1], i);
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

    for (let i = 0; i < pairsToFetch.length; ++i) {
      const pairState = reserves[i];
      const pair = pairsToFetch[i];
      if (!pair.pool) {
        await this.addPair(
          pair,
          pairState.reserve0,
          pairState.reserve1,
          pairState.curveId,
          blockNumber,
        );
      } else {
        pair.pool.setState(pairState, blockNumber);
      }
    }
  }

  getSellPrice(priceParams: ReservoirOrderedParams, amount: bigint): bigint {
    if (priceParams.stable) {
      return ReservoirStablePool.getSellPrice(priceParams, amount);
    } else {
      return ReservoirConstantProductPool.getSellPrice(priceParams, amount);
    }
  }

  getBuyPrice(priceParams: ReservoirOrderedParams, amount: bigint): bigint {
    if (priceParams.stable) {
      return ReservoirStablePool.getBuyPrice(priceParams, amount);
    } else {
      return ReservoirConstantProductPool.getBuyPrice(priceParams, amount);
    }
  }

  // we're not considering multi-hop scenarios in this case
  // if one day we need to cater for this case, refer to uniswap-v2's impl of the same function
  getSellPricePath(amount: bigint, params: ReservoirOrderedParams[]): bigint[] {
    return params.map(param => {
      return this.getSellPrice(param, amount);
    });
  }

  getBuyPricePath(amount: bigint, params: ReservoirOrderedParams[]): bigint[] {
    return params.map(param => {
      return this.getBuyPrice(param, amount);
    });
  }

  async getPairOrderedParams(
    from: Token,
    to: Token,
    blockNumber: number,
  ): Promise<ReservoirOrderedParams[] | null> {
    const orderedParamsResult: ReservoirOrderedParams[] = [];

    const constantProduct = await this.findPair(from, to, 0);
    const stable = await this.findPair(from, to, 1);

    if (constantProduct && constantProduct.pool && constantProduct.exchange) {
      const pairState = constantProduct.pool.getState(blockNumber);

      if (pairState) {
        const pairReversed =
          constantProduct.token1.address.toLowerCase() ==
          from.address.toLowerCase();

        if (pairReversed) {
          orderedParamsResult.push({
            tokenIn: from.address,
            tokenOut: to.address,
            reservesIn: pairState.reserve1,
            reservesOut: pairState.reserve0,
            stable: null,
            fee: '0',
            direction: false,
            exchange: constantProduct.exchange,
          });
        } else {
          orderedParamsResult.push({
            tokenIn: from.address,
            tokenOut: to.address,
            reservesIn: pairState.reserve0,
            reservesOut: pairState.reserve1,
            stable: null,
            fee: '0',
            direction: true,
            exchange: constantProduct.exchange,
          });
        }
      } else {
        this.logger.error(
          `Error_orderPairParams expected reserves, got none (maybe the pool doesn't exist) ${
            from.symbol || from.address
          } ${to.symbol || to.address} constant product`,
        );
      }
    }
    if (stable && stable.pool && stable.exchange) {
      const pairState = stable.pool.getState(blockNumber);

      if (pairState) {
        const pairReversed =
          stable.token1.address.toLowerCase() == from.address.toLowerCase();

        if (pairReversed) {
          orderedParamsResult.push({
            tokenIn: from.address,
            tokenOut: to.address,
            reservesIn: pairState.reserve1,
            reservesOut: pairState.reserve0,
            stable: {
              decimalsIn: 0n,
              decimalsOut: 0n,
              ampCoefficient: 0n,
            },
            fee: '0',
            direction: false,
            exchange: stable.exchange,
          });
        } else {
          orderedParamsResult.push({
            tokenIn: from.address,
            tokenOut: to.address,
            reservesIn: pairState.reserve0,
            reservesOut: pairState.reserve1,
            stable: {
              decimalsIn: 0n,
              decimalsOut: 0n,
              ampCoefficient: 0n,
            },
            fee: '0',
            direction: true,
            exchange: stable.exchange,
          });
        }
      } else {
        this.logger.error(
          `Error_orderPairParams expected reserves, got none (maybe the pool doesn't exist) ${
            from.symbol || from.address
          } ${to.symbol || to.address} stable`,
        );
      }
    }

    return orderedParamsResult.length > 0 ? null : orderedParamsResult;
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
    transferFees: TransferFeeParams = {
      srcFee: 0,
      destFee: 0,
      srcDexFee: 0,
      destDexFee: 0,
    },
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

      const pairsParam = await this.getPairOrderedParams(from, to, blockNumber);

      if (!pairsParam) return null;

      const unitAmount: bigint = getBigIntPow(
        isSell ? from.decimals : to.decimals,
      );

      const [unitVolumeWithFee, ...amountsWithFee] = applyTransferFee(
        [unitAmount, ...amounts],
        side,
        isSell ? transferFees.srcFee : transferFees.destFee,
        isSell ? SRC_TOKEN_PARASWAP_TRANSFERS : DEST_TOKEN_PARASWAP_TRANSFERS,
      );

      const unit = isSell
        ? this.getSellPricePath(unitVolumeWithFee, pairsParam)
        : this.getBuyPricePath(unitVolumeWithFee, pairsParam);

      const prices = isSell
        ? amountsWithFee.map(amount =>
            this.getSellPricePath(amount, pairsParam),
          )
        : amountsWithFee.map(amount =>
            this.getBuyPricePath(amount, pairsParam),
          );

      const unitOutWithfee = applyTransferFee(
        [...unit],
        side,
        isSell ? transferFees.destDexFee : transferFees.srcFee,
        isSell ? DEST_TOKEN_DEX_TRANSFERS : SRC_TOKEN_PARASWAP_TRANSFERS,
      );

      const outputsWithFee = prices.map(pricesForCurve =>
        applyTransferFee(
          [...pricesForCurve],
          side,
          isSell ? transferFees.destDexFee : transferFees.srcFee,
          isSell ? DEST_TOKEN_DEX_TRANSFERS : SRC_TOKEN_PARASWAP_TRANSFERS,
        ),
      );

      // we return up to ReservoirPoolTypes.length pairs for each srcToken -> destToken query as we have 2 curve types
      // if we increase the types of curves in the future this will go up as well
      return pairsParam.map((pair, index) => {
        return {
          prices: outputsWithFee[index],
          unit: unitOutWithfee[index],
          data: {
            router: this.router,
            path: [from.address.toLowerCase(), to.address.toLowerCase()],
            curveIds: [
              pair.stable
                ? ReservoirPoolTypes.Stable
                : ReservoirPoolTypes.ConstantProduct,
            ],
            type: side,
          },
          exchange: this.dexKey,
          poolIdentifier,
          gasCost: 0, // gotta fill this in somehow
          poolAddresses: [pair.exchange],
        };
      });
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
      [srcAmount, destAmount, srcToken, destToken, data.curveIds],
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
