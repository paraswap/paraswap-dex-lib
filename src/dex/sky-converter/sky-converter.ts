import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  PoolLiquidity,
  Logger,
  NumberAsString,
  DexExchangeParam,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { SkyConverterData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { SkyConverterConfig } from './config';
import { BI_POWS } from '../../bigint-constants';

export class SkyConverter
  extends SimpleExchange
  implements IDex<SkyConverterData>
{
  // readonly skyConverterInterface = new Interface(SkyConverterABI);
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SkyConverterConfig);

  logger: Logger;

  oldToken: Address;
  newToken: Address;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    readonly config = SkyConverterConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);

    this.oldToken = this.config.oldTokenAddress.toLowerCase();
    this.newToken = this.config.newTokenAddress.toLowerCase();
  }

  async initializePricing(blockNumber: number) {}

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (
      srcToken.address.toLowerCase() === this.oldToken &&
      destToken.address.toLowerCase() === this.newToken
    ) {
      return [`${this.network}_${destToken.address}`];
    } else if (
      srcToken.address.toLowerCase() === this.newToken &&
      destToken.address.toLowerCase() === this.oldToken
    ) {
      return [`${this.network}_${srcToken.address}`];
    } else {
      return [];
    }
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<SkyConverterData>> {
    const isKnown =
      (srcToken.address.toLowerCase() === this.oldToken &&
        destToken.address.toLowerCase() === this.newToken) ||
      (srcToken.address.toLowerCase() === this.newToken &&
        destToken.address.toLowerCase() === this.oldToken);

    if (!isKnown) {
      return null;
    }

    return [
      {
        prices: amounts,
        unit: BI_POWS[18],
        // TODO: Update after simulations
        gasCost: 40_000,
        exchange: this.dexKey,
        poolAddresses: [this.config.converterAddress],
        data: null,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<SkyConverterData>,
  ): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SkyConverterData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: '0x',
      payload,
      networkFee: '0',
    };
  }

  oldAmountToNewAmount(amount: bigint) {
    return amount * this.config.newTokenRateMultiplier;
  }

  newAmountToOldAmount(amount: bigint) {
    return amount / this.config.newTokenRateMultiplier;
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: SkyConverterData,
    side: SwapSide,
  ): DexExchangeParam {
    const swapData = this.config.converterIface.encodeFunctionData(
      srcToken === this.oldToken
        ? this.config.oldToNewFunctionName
        : this.config.newToOldFunctionName,
      [recipient, side === SwapSide.SELL ? srcAmount : destAmount],
    );

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData: swapData,
      targetExchange: this.config.converterAddress,
      returnAmountPos: undefined,
    };
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }
}
