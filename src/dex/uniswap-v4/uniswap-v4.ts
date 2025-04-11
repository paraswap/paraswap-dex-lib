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
import { Network, NULL_ADDRESS } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { IDex } from '../idex';
import { SimpleExchange } from '../simple-exchange';
import { UniswapV4Config } from './config';
import { Pool, UniswapV4Data } from './types';
import { BytesLike } from 'ethers';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import QuoterAbi from '../../abi/uniswap-v4/quoter.abi.json';
import { BI_POWS } from '../../bigint-constants';
import { Interface } from '@ethersproject/abi';
import { generalDecoder } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';
import {
  swapExactInputSingleCalldata,
  swapExactOutputSingleCalldata,
} from './encoder';
import { UniswapV4PoolManager } from './uniswap-v4-pool-manager';
import { DeepReadonly } from 'ts-essentials';
import { PoolState } from '../uniswap-v4/types';
import { uniswapV4PoolMath } from './contract-math/uniswap-v4-pool-math';
import { SwapSide } from '@paraswap/core';

export class UniswapV4 extends SimpleExchange implements IDex<UniswapV4Data> {
  readonly hasConstantPriceLargeAmounts = false;
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
    );
  }

  async initializePricing(blockNumber: number) {
    await this.poolManager.initialize(blockNumber);
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

    return pools.map(pool => pool.id);
  }

  protected _getOutputs(
    pool: Pool,
    state: DeepReadonly<PoolState>,
    amounts: bigint[],
    zeroForOne: boolean,
    side: SwapSide,
  ): bigint[] | null {
    try {
      const outputsResult = uniswapV4PoolMath.queryOutputs(
        pool,
        state,
        amounts,
        zeroForOne,
        side,
      );

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
    const pools: Pool[] = await this.poolManager.getAvailablePoolsForPair(
      from.address.toLowerCase(),
      to.address.toLowerCase(),
      blockNumber,
    );

    let availablePools =
      limitPools?.filter(t => pools.find(p => p.id === t)) ??
      pools.map(t => t.id);

    // availablePools = availablePools.filter(
    //   poolId =>
    //     poolId.toLowerCase() ===
    //     '0xe87077fd043c1a6afa5256104acb1d1eb5ca5bc031ee57f9d96c8172ead4bef8'.toLowerCase(),
    // );

    const pricesPromises = availablePools.map(async poolId => {
      const pool = pools.find(p => p.id === poolId)!;

      const zeroForOne =
        from.address.toLowerCase() === pool.key.currency0.toLowerCase() ||
        (isETHAddress(from.address) && pool.key.currency0 === NULL_ADDRESS);

      // const prices = await this.queryPriceFromRpc(
      //   zeroForOne,
      //   amounts,
      //   pool,
      //   side,
      //   blockNumber,
      // );

      const eventPool = this.poolManager.eventPools[poolId];
      const poolState = await eventPool.getOrGenerateState(blockNumber);

      const prices = this._getOutputs(
        pool,
        poolState,
        amounts,
        zeroForOne,
        side,
      );

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
          exchange: this.dexKey,
          pool: {
            id: pool.id,
            key: pool.key,
          },
          zeroForOne,
        },
        poolAddresses: [this.poolManagerAddress],
        exchange: this.dexKey,
        gasCost: 100_000,
        poolIdentifier: poolId,
      };
    });

    const prices = await Promise.all(pricesPromises);
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
    count: number,
  ): Promise<PoolLiquidity[]> {
    const _tokenAddress = tokenAddress.toLowerCase();
    return [];
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
    let exchangeData: string;
    if (side === SwapSide.SELL) {
      exchangeData = swapExactInputSingleCalldata(
        srcToken,
        destToken,
        data.pool.key,
        data.zeroForOne,
        BigInt(srcAmount),
        // destMinAmount (can be 0 on dex level)
        BigInt(0),
        recipient,
      );
    } else {
      exchangeData = swapExactOutputSingleCalldata(
        srcToken,
        destToken,
        data.pool.key,
        data.zeroForOne,
        BigInt(destAmount),
        BigInt(srcAmount),
        recipient,
      );
    }

    return {
      needWrapNative: this.needWrapNative,
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
    const { exchange } = data;

    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }
}
