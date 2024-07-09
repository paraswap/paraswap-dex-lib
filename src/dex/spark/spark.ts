import { SimpleExchange } from '../simple-exchange';
import { Context, IDex } from '../idex';
import { SparkParams, SparkData, SparkSDaiFunctions } from './types';
import { Network, SwapSide } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import { Adapters, SDaiConfig } from './config';
import {
  AdapterExchangeParam,
  Address,
  DexExchangeParam,
  ExchangePrices,
  Logger,
  NumberAsString,
  PoolLiquidity,
  PoolPrices,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { IDexHelper } from '../../dex-helper';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import PotAbi from '../../abi/maker-psm/pot.json';
import SavingsDaiAbi from '../../abi/sdai/SavingsDai.abi.json';
import { Interface } from 'ethers/lib/utils';
import { SparkSDaiEventPool } from './spark-sdai-pool';
import { BI_POWS } from '../../bigint-constants';
import { SDAI_DEPOSIT_GAS_COST, SDAI_REDEEM_GAS_COST } from './constants';
import { extractReturnAmountPosition } from '../../executor/utils';

export class Spark
  extends SimpleExchange
  implements IDex<SparkData, SparkParams>
{
  readonly hasConstantPriceLargeAmounts = true;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SDaiConfig);

  public readonly eventPool: SparkSDaiEventPool;
  logger: Logger;

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,

    readonly daiAddress: string = SDaiConfig[dexKey][network].daiAddress,
    readonly sdaiAddress: string = SDaiConfig[dexKey][network].sdaiAddress,
    readonly potAddress: string = SDaiConfig[dexKey][network].potAddress,

    protected adapters = Adapters[network] || {},
    protected sdaiInterface = new Interface(SavingsDaiAbi),
    protected potInterface = new Interface(PotAbi),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPool = new SparkSDaiEventPool(
      this.dexKey,
      `${this.daiAddress}_${this.sdaiAddress}`,
      dexHelper,
      this.potAddress,
      this.potInterface,
      this.logger,
    );
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] || null;
  }

  isSDai(tokenAddress: Address) {
    return this.sdaiAddress.toLowerCase() === tokenAddress.toLowerCase();
  }

  isDai(tokenAddress: Address) {
    return this.daiAddress.toLowerCase() === tokenAddress.toLowerCase();
  }

  isAppropriatePair(srcToken: Token, destToken: Token) {
    return (
      (this.isDai(srcToken.address) && this.isSDai(destToken.address)) ||
      (this.isDai(destToken.address) && this.isSDai(srcToken.address))
    );
  }

  async initializePricing(blockNumber: number) {
    await this.eventPool.initialize(blockNumber);
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    return this.isAppropriatePair(srcToken, destToken)
      ? [`${this.dexKey}_${this.sdaiAddress}`]
      : [];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<SparkData>> {
    if (!this.isAppropriatePair(srcToken, destToken)) return null;
    if (!this.eventPool.getState(blockNumber)) return null;

    if (side === SwapSide.SELL) {
      const calcSellFn = (blockNumber: number, amountIn: bigint) =>
        this.isDai(srcToken.address)
          ? this.eventPool.convertToSDai(amountIn, blockNumber)
          : this.eventPool.convertToDai(amountIn, blockNumber);

      return [
        {
          prices: amounts.map(amount => calcSellFn(blockNumber, amount)),
          unit: calcSellFn(blockNumber, BI_POWS[18]),
          gasCost: SDAI_DEPOSIT_GAS_COST,
          exchange: this.dexKey,
          data: { exchange: `${this.sdaiAddress}` },
          poolAddresses: [`${this.sdaiAddress}`],
        },
      ];
    } else {
      const calcBuyFn = (blockNumber: number, amountIn: bigint) =>
        this.isDai(srcToken.address)
          ? this.eventPool.convertToDai(amountIn, blockNumber)
          : this.eventPool.convertToSDai(amountIn, blockNumber);

      return [
        {
          prices: amounts.map(amount => calcBuyFn(blockNumber, amount)),
          unit: calcBuyFn(blockNumber, BI_POWS[18]),
          gasCost: SDAI_REDEEM_GAS_COST,
          exchange: this.dexKey,
          data: { exchange: `${this.sdaiAddress}` },
          poolAddresses: [`${this.sdaiAddress}`],
        },
      ];
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<SparkData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.isDai(tokenAddress) && !this.isSDai(tokenAddress)) return [];

    return [
      {
        exchange: this.dexKey,
        address: this.sdaiAddress,
        connectorTokens: [
          {
            decimals: 18,
            address: this.isDai(tokenAddress)
              ? this.sdaiAddress
              : this.daiAddress,
          },
        ],
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
    ];
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SparkData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const isSell = side === SwapSide.SELL;
    const { exchange } = data;

    let swapData: string;
    if (this.isDai(srcToken)) {
      swapData = this.sdaiInterface.encodeFunctionData(
        isSell ? SparkSDaiFunctions.deposit : SparkSDaiFunctions.mint,
        [isSell ? srcAmount : destAmount, this.augustusAddress],
      );
    } else {
      swapData = this.sdaiInterface.encodeFunctionData(
        isSell ? SparkSDaiFunctions.redeem : SparkSDaiFunctions.withdraw,
        [
          isSell ? srcAmount : destAmount,
          this.augustusAddress,
          this.augustusAddress,
        ],
      );
    }

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
      undefined,
      undefined,
      undefined,
      isSell && this.isDai(destToken),
    );
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: SparkData,
    side: SwapSide,
    _: Context,
    executorAddress: Address,
  ): DexExchangeParam {
    const isSell = side === SwapSide.SELL;
    const { exchange } = data;

    let swapData: string;
    if (this.isDai(srcToken)) {
      swapData = this.sdaiInterface.encodeFunctionData(
        isSell ? SparkSDaiFunctions.deposit : SparkSDaiFunctions.mint,
        [isSell ? srcAmount : destAmount, recipient],
      );
    } else {
      swapData = this.sdaiInterface.encodeFunctionData(
        isSell ? SparkSDaiFunctions.redeem : SparkSDaiFunctions.withdraw,
        [isSell ? srcAmount : destAmount, recipient, executorAddress],
      );
    }

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData: swapData,
      targetExchange: exchange,
      returnAmountPos: isSell
        ? extractReturnAmountPosition(
            this.sdaiInterface,
            this.isDai(srcToken)
              ? SparkSDaiFunctions.deposit
              : SparkSDaiFunctions.redeem,
            this.isDai(srcToken) ? 'shares' : 'assets',
          )
        : undefined,
    };
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SparkData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { exchange } = data;

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          toStaked: 'bool',
        },
      },
      {
        toStaked: this.isDai(srcToken),
      },
    );

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }
}
