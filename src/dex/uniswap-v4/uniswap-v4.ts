import {
  AdapterExchangeParam,
  Address,
  DexExchangeParam,
  ExchangePrices,
  NumberAsString,
  PoolLiquidity,
  PoolPrices,
  Token,
} from '../../types';
import { Logger } from 'log4js';
import { ETHER_ADDRESS, Network, NULL_ADDRESS } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { IDex } from '../idex';
import { SimpleExchange } from '../simple-exchange';
import { UniswapV4Config } from './config';
import { Pool, PoolPairsInfo, UniswapV4Data } from './types';
import { BytesLike } from 'ethers';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import QuoterAbi from '../../abi/uniswap-v4/quoter.abi.json';
import { BI_MAX_UINT128, BI_POWS } from '../../bigint-constants';
import { Interface } from '@ethersproject/abi';
import { generalDecoder } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';
import {
  swapExactInputCalldata,
  swapExactInputSingleCalldata,
  swapExactOutputCalldata,
  swapExactOutputSingleCalldata,
} from './encoder';
import { UniswapV4PoolManager } from './uniswap-v4-pool-manager';
import { DeepReadonly } from 'ts-essentials';
import { PoolState } from '../uniswap-v4/types';
import { uniswapV4PoolMath } from './contract-math/uniswap-v4-pool-math';
import { SwapSide } from '@paraswap/core';
import { queryAvailablePoolsForToken } from './subgraph';
import _ from 'lodash';
import { UNISWAPV4_EFFICIENCY_FACTOR } from './constants';
import { PoolsRegistryHashKey } from '../uniswap-v3/uniswap-v3';

export class UniswapV4 extends SimpleExchange implements IDex<UniswapV4Data> {
  readonly hasConstantPriceLargeAmounts = false;

  // to prevent wrap/unwrap on v6 contract level, because we are doing wrap/unwrap on UniV4 Router level, check tx encoder for details
  needWrapNative = false;

  logger: Logger;
  protected quoterIface: Interface;

  private poolManager: UniswapV4PoolManager;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UniswapV4Config);

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected routerAddress = UniswapV4Config[dexKey][network].router,
    protected quoterAddress = UniswapV4Config[dexKey][network].quoter,
    protected poolManagerAddress = UniswapV4Config[dexKey][network].poolManager,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.quoterIface = new Interface(QuoterAbi);

    this.poolManager = new UniswapV4PoolManager(
      dexHelper,
      dexKey,
      network,
      UniswapV4Config[dexKey][network],
      this.logger,
      this.cacheStateKey,
    );
  }

  async initializePricing(blockNumber: number) {
    await this.poolManager.initialize(blockNumber);
  }

  async addMasterPool(poolKey: string, blockNumber: number): Promise<boolean> {
    const _pairs = await this.dexHelper.cache.hget(
      PoolsRegistryHashKey,
      `${this.cacheStateKey}_${poolKey}`,
    );
    if (!_pairs) {
      this.logger.warn(
        `${this.dexKey}: did not find poolConfig in for key ${PoolsRegistryHashKey} ${this.cacheStateKey}_${poolKey}`,
      );
      return false;
    }

    const poolInfo: PoolPairsInfo = JSON.parse(_pairs);
    const pool = await this.poolManager.getEventPool(
      poolInfo.poolId,
      blockNumber,
    );

    if (!pool) {
      return false;
    }

    return true;
  }

  async getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const pools = await this.poolManager.getAvailablePoolsForPair(
      from.address.toLowerCase(),
      to.address.toLowerCase(),
      blockNumber,
    );

    const eventPools = (
      await Promise.all(
        pools.map(async pool =>
          this.poolManager.getEventPool(pool.id, blockNumber),
        ),
      )
    ).filter(pool => pool !== null);

    return eventPools.map(eventPool => eventPool!.poolId);
  }

  protected _getOutputs(
    pool: Pool,
    state: DeepReadonly<PoolState>,
    amounts: bigint[],
    zeroForOne: boolean,
    side: SwapSide,
    reqId: number,
  ): bigint[] | null {
    try {
      const outputsResult = uniswapV4PoolMath.queryOutputs(
        pool,
        state,
        amounts,
        zeroForOne,
        side,
        this.logger,
        reqId,
      );

      if (
        outputsResult !== null &&
        side === SwapSide.BUY &&
        outputsResult[outputsResult?.length - 1] === 0n
      ) {
        return null;
      }

      return outputsResult;
    } catch (e) {
      this.logger.debug(
        `${this.dexKey}: received error in _getOutputs while calculating outputs`,
        e,
      );
      return null;
    }
  }

  async getPricesVolume(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<ExchangePrices<UniswapV4Data> | null> {
    const reqId = Math.floor(Math.random() * 10000);
    // const getPricesVolumeStart = Date.now();

    const wethAddr =
      this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase();
    let pools: Pool[] = await this.poolManager.getAvailablePoolsForPair(
      from.address.toLowerCase(),
      to.address.toLowerCase(),
      blockNumber,
    );

    const availablePools =
      limitPools?.filter(t => pools.find(p => p.id === t)) ??
      pools.map(t => t.id);

    const pricesPromises = availablePools.map(async poolId => {
      const pool = pools.find(p => p.id === poolId)!;

      const zeroForOne =
        from.address.toLowerCase() === pool.key.currency0.toLowerCase() ||
        (isETHAddress(from.address) && pool.key.currency0 === NULL_ADDRESS) || // ETH is src and native ETH pool
        (isETHAddress(from.address) && pool.key.currency0 === wethAddr) || // ETH is src and WETH pool
        (from.address.toLowerCase() === wethAddr &&
          pool.key.currency0 === NULL_ADDRESS); // WETH is src and native ETH pool

      const eventPool = await this.poolManager.getEventPool(
        poolId,
        blockNumber,
      );

      const poolState = (await eventPool?.getState(blockNumber)) || null;

      let prices: bigint[] | null;
      if (poolState !== null && poolState.isValid) {
        // const getOutputsStart = Date.now();
        prices = this._getOutputs(
          pool,
          poolState,
          amounts,
          zeroForOne,
          side,
          reqId,
        );

        // this.logger.info(
        //   `_getOutputs_${pool.id}_${reqId}: ${
        //     Date.now() - getOutputsStart
        //   } ms (src: ${from.address}, dest: ${
        //     to.address
        //   }, amounts: ${JSON.stringify(amounts)})`,
        // );
      } else {
        this.logger.warn(
          `${this.dexKey}-${this.network}: pool ${poolId} state was not found...falling back to rpc`,
        );
        prices = await this.queryPriceFromRpc(
          zeroForOne,
          amounts,
          pool,
          side,
          blockNumber,
        );
      }

      if (prices === null) {
        return null;
      }

      if (prices?.every(price => price === 0n || price === 1n)) {
        return null;
      }

      return {
        unit: BI_POWS[to.decimals],
        prices,
        data: {
          path: [
            {
              pool: {
                id: pool.id,
                key: pool.key,
              },
              tokenIn: zeroForOne ? pool.key.currency0 : pool.key.currency1,
              tokenOut: zeroForOne ? pool.key.currency1 : pool.key.currency0,
              zeroForOne,
            },
          ],
        },
        poolAddresses: [this.poolManagerAddress],
        exchange: this.dexKey,
        gasCost: 100_000,
        poolIdentifier: poolId,
      };
    });

    const prices = await Promise.all(pricesPromises);
    // this.logger.info(
    //   `getPricesVolume_${from.address}_${to.address}_${reqId}: ${
    //     Date.now() - getPricesVolumeStart
    //   } ms`,
    // );
    return prices.filter(res => res !== null);
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<UniswapV4Data>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    let _tokenAddress = tokenAddress.toLowerCase();
    if (isETHAddress(_tokenAddress)) _tokenAddress = NULL_ADDRESS;

    const { pools0, pools1 } = await queryAvailablePoolsForToken(
      this.dexHelper,
      this.logger,
      this.dexKey,
      UniswapV4Config[this.dexKey][this.network].subgraphURL,
      _tokenAddress,
      limit,
    );

    if (!(pools0 || pools1)) {
      this.logger.error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );
      return [];
    }

    const connectors0: PoolLiquidity[] = _.map(pools0, pool => ({
      exchange: this.dexKey,
      address: this.poolManagerAddress,
      connectorTokens: [
        {
          address:
            pool.token1.address.toLowerCase() === NULL_ADDRESS
              ? ETHER_ADDRESS
              : pool.token1.address.toLowerCase(),
          decimals: parseInt(pool.token1.decimals),
        },
      ],
      liquidityUSD: parseFloat(pool.volumeUSD) * UNISWAPV4_EFFICIENCY_FACTOR,
    }));

    const connectors1: PoolLiquidity[] = _.map(pools1, pool => ({
      exchange: this.dexKey,
      address: this.poolManagerAddress,
      connectorTokens: [
        {
          address:
            pool.token0.address.toLowerCase() === NULL_ADDRESS
              ? ETHER_ADDRESS
              : pool.token0.address.toLowerCase(),
          decimals: parseInt(pool.token0.decimals),
        },
      ],
      liquidityUSD: parseFloat(pool.volumeUSD) * UNISWAPV4_EFFICIENCY_FACTOR,
    }));

    const pools: PoolLiquidity[] = _.slice(
      _.sortBy(_.concat(connectors0, connectors1), [
        pool => -1 * pool.liquidityUSD,
      ]),
      0,
      limit,
    );

    return pools;
  }

  async queryPriceFromRpc(
    zeroForOne: boolean,
    amounts: bigint[],
    pool: Pool,
    side: SwapSide,
    blockNumber: number,
  ): Promise<bigint[]> {
    const funcName =
      side === SwapSide.SELL
        ? 'quoteExactInputSingle'
        : 'quoteExactOutputSingle';

    const calls = amounts.map(amount => ({
      target: this.quoterAddress,
      callData: this.quoterIface.encodeFunctionData(funcName, [
        {
          poolKey: pool.key,
          zeroForOne,
          exactAmount: amount.toString(),
          hookData: '0x',
        },
      ]),
      decodeFunction: (result: MultiResult<BytesLike> | BytesLike): bigint => {
        // amountOut, gasEstimate
        return generalDecoder(result, ['uint256', 'uint256'], 0n, value =>
          BigInt(value[0].toString()),
        );
      },
    }));

    const results = await this.dexHelper.multiWrapper!.tryAggregate(
      false,
      calls,
      blockNumber,
    );
    return results.map(result => (result.success ? result.returnData : 0n));
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: UniswapV4Data,
    side: SwapSide,
  ): DexExchangeParam {
    let encodingMethod: (
      srcToken: Address,
      destToken: Address,
      data: UniswapV4Data,
      amount1: bigint,
      amount2: bigint,
      recipient: Address,
      dexHelper: IDexHelper,
    ) => string;

    if (data.path.length === 1 && side === SwapSide.SELL) {
      // Single-hop encoding for SELL side
      encodingMethod = swapExactInputSingleCalldata;
    } else if (data.path.length === 1 && side === SwapSide.BUY) {
      // Single-hop encoding for BUY side
      encodingMethod = swapExactOutputSingleCalldata;
    } else if (data.path.length > 1 && side === SwapSide.SELL) {
      // Multi-hop encoding for SELL side
      encodingMethod = swapExactInputCalldata;
    } else if (data.path.length > 1 && side === SwapSide.BUY) {
      // Multi-hop encoding for BUY side
      encodingMethod = swapExactOutputCalldata;
    } else {
      throw new Error(
        `${this.dexKey}-${this.network}: Logic error for side: ${side}, data.path.length: ${data.path.length}`,
      );
    }

    const exchangeData = encodingMethod(
      srcToken,
      destToken,
      data,
      BigInt(srcAmount),
      side === SwapSide.SELL ? 0n : BigInt(destAmount),
      recipient,
      this.dexHelper,
    );

    return {
      needWrapNative: this.needWrapNative,
      sendEthButSupportsInsertFromAmount: true,
      dexFuncHasRecipient: true,
      exchangeData,
      targetExchange: this.routerAddress,
      permit2Approval: true,
      returnAmountPos: undefined,
    };
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV4Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload = '0x';

    return {
      targetExchange: this.routerAddress,
      payload,
      networkFee: '0',
    };
  }
}
