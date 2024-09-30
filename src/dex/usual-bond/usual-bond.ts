import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  Logger,
  NumberAsString,
  DexExchangeParam,
  PoolLiquidity,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { UsualBondData, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { UsualBondConfig } from './config';
import { Interface, JsonFragment } from '@ethersproject/abi';
import USD0PP_ABI from '../../abi/usual-bond/usd0pp.abi.json';
import { BI_POWS } from '../../bigint-constants';

export class UsualBond extends SimpleExchange implements IDex<UsualBondData> {
  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = true;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UsualBondConfig);

  usd0ppIface: Interface;
  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    super(dexHelper, dexKey);
    const config = UsualBondConfig[dexKey][network];
    this.usd0ppIface = new Interface(USD0PP_ABI as JsonFragment[]);
    this.config = {
      usd0Address: config.usd0Address.toLowerCase(),
      usd0ppAddress: config.usd0ppAddress.toLowerCase(),
    };
    this.logger = dexHelper.getLogger(dexKey);
  }

  async initializePricing(blockNumber: number) {
    // No initialization needed for constant price
  }

  getConfig() {
    return this.config;
  }

  is_usd0(token: string) {
    return token.toLowerCase() === this.config.usd0Address.toLowerCase();
  }

  is_usd0pp(token: string) {
    return token.toLowerCase() === this.config.usd0ppAddress.toLowerCase();
  }

  is_usd0_swap_token(srcToken: string, destToken: string) {
    return this.is_usd0(srcToken) && this.is_usd0pp(destToken);
  }

  getAdapters() {
    return null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (!srcToken || !destToken) {
      this.logger.error('Source or destination token is undefined');
      return [];
    }

    const srcTokenAddress = srcToken.address?.toLowerCase();
    const destTokenAddress = destToken.address?.toLowerCase();

    if (!srcTokenAddress || !destTokenAddress) {
      this.logger.error('Source or destination token address is undefined');
      return [];
    }

    if (this.is_usd0_swap_token(srcTokenAddress, destTokenAddress)) {
      return [`${this.dexKey}_${this.config.usd0ppAddress}`];
    }

    return [];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<UsualBondData>> {
    if (side === SwapSide.BUY) {
      return null;
    }

    const isUSD0SwapToken = this.is_usd0_swap_token(
      srcToken.address,
      destToken.address,
    );

    if (!isUSD0SwapToken) {
      return null;
    }

    const unitOut = BI_POWS[18]; // 1:1 swap
    const amountsOut = amounts; // 1:1 swap, so output amounts are the same as input

    return [
      {
        unit: unitOut,
        prices: amountsOut,
        data: {},
        poolAddresses: [this.config.usd0ppAddress],
        exchange: this.dexKey,
        gasCost: 70000,
        poolIdentifier: this.dexKey,
      },
    ];
  }

  getCalldataGasCost(poolPrices: PoolPrices<UsualBondData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UsualBondData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload = '0x';

    return {
      targetExchange: this.config.usd0ppAddress,
      payload,
      networkFee: '0',
    };
  }

  async getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: UsualBondData,
    side: SwapSide,
  ): Promise<DexExchangeParam> {
    if (this.is_usd0(srcToken) && this.is_usd0pp(destToken)) {
      const exchangeData = this.usd0ppIface.encodeFunctionData('mint', [
        srcAmount,
      ]);

      return {
        needWrapNative: false,
        dexFuncHasRecipient: false,
        exchangeData,
        targetExchange: this.config.usd0ppAddress,
        returnAmountPos: undefined,
      };
    }
    throw new Error('LOGIC ERROR');
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const isUsd0 = this.is_usd0(tokenAddress);
    if (!isUsd0 && !this.is_usd0pp(tokenAddress)) return [];

    return [
      {
        exchange: this.dexKey,
        address: this.config.usd0ppAddress,
        connectorTokens: [
          {
            decimals: 18,
            address: isUsd0
              ? this.config.usd0ppAddress
              : this.config.usd0Address,
          },
        ],
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
    ];
  }
}
