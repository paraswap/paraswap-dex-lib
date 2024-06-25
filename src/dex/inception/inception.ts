import { Interface, JsonFragment } from '@ethersproject/abi';
import { AsyncOrSync } from 'ts-essentials';
import { NumberAsString, SwapSide } from '@paraswap/core';
import {
  AdapterExchangeParam,
  Address,
  DexExchangeParam,
  ExchangePrices,
  Logger,
  PoolLiquidity,
  PoolPrices,
  Token,
} from '../../types';
import INCEPTION_ABI from '../../abi/inception/inception-vault.json';
import { Network, NULL_ADDRESS } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { InceptionData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, InceptionConfig } from './config';
import { InceptionPool } from './inception-pool';
import { ethers } from 'ethers';
import { BI_POWS } from '../../bigint-constants';

export const depositETHFunction = 'deposit';

export class Inception extends SimpleExchange implements IDex<InceptionData> {
  protected inceptionPool: InceptionPool;
  protected vaultInterface: Interface;
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(InceptionConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected config = InceptionConfig[dexKey][network],
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.vaultInterface = new Interface(INCEPTION_ABI as JsonFragment[]);
    this.inceptionPool = new InceptionPool(
      this.dexKey,
      network,
      dexHelper,
      this.logger,
      this.config.vault,
      this.vaultInterface,
    );
  }

  async initializePricing(blockNumber: number) {
    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate([
          {
            target: this.config.vault,
            callData: this.vaultInterface.encodeFunctionData('ratio', []),
          },
        ])
        .call({}, blockNumber);

    const decodedData = data.returnData.map(d =>
      ethers.utils.defaultAbiCoder.decode(['uint256'], d),
    );
    const [ratio] = decodedData.map(d => BigInt(d[0].toString()));

    await Promise.all([
      this.inceptionPool.initialize(blockNumber, {
        state: { ratio },
      }),
    ]);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    return [`${srcToken.address}_${destToken.address}`.toLowerCase()];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<InceptionData>> {
    const pool = this.inceptionPool;

    if (!pool.getState(blockNumber)) return null;

    const unitIn = BI_POWS[18];
    const unitOut = pool.getPrice(blockNumber, unitIn);
    const amountsOut = amounts.map(amountIn =>
      pool.getPrice(blockNumber, amountIn),
    );

    return [
      {
        prices: amountsOut,
        unit: unitOut,
        data: {
          ratio: unitOut,
        },
        exchange: this.dexKey,
        poolIdentifier:
          `${srcToken.address}_${destToken.address}`.toLowerCase(),
        gasCost: 120_000,
        poolAddresses: [this.config.vault],
      },
    ];
  }

  getCalldataGasCost(poolPrices: PoolPrices<InceptionData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_OVERHEAD + CALLDATA_GAS_COST.LENGTH_SMALL;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: InceptionData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: NULL_ADDRESS,
      payload: '0x',
      networkFee: '0',
    };
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: InceptionData,
    side: SwapSide,
  ): DexExchangeParam {
    const swapData = this.vaultInterface.encodeFunctionData(
      depositETHFunction,
      [srcAmount, recipient],
    );

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData: swapData,
      targetExchange: this.config.vault,
      swappedAmountNotPresentInExchangeData: true,
      returnAmountPos: undefined,
    };
  }
  async updatePoolState(): Promise<void> {}

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }

  releaseResources(): AsyncOrSync<void> {}
}
