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
import { UsualMSmartMData, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { UsualMSmartMConfig } from './config';
import { Interface, JsonFragment } from '@ethersproject/abi';
import USUALM_ABI from '../../abi/usual-m-smart-m/usualM.abi.json';
import { BI_POWS } from '../../bigint-constants';

export class UsualMSmartM
  extends SimpleExchange
  implements IDex<UsualMSmartMData>
{
  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = true;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UsualMSmartMConfig);

  usualMIface: Interface;
  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    super(dexHelper, dexKey);
    const config = UsualMSmartMConfig[dexKey][network];
    this.usualMIface = new Interface(USUALM_ABI as JsonFragment[]);
    this.config = {
      smartMAddress: config.smartMAddress.toLowerCase(),
      usualMAddress: config.usualMAddress.toLowerCase(),
    };
    this.logger = dexHelper.getLogger(dexKey);
  }

  async initializePricing(blockNumber: number) {
    // No initialization needed for constant price
  }

  getConfig() {
    return this.config;
  }

  is_smartM(token: string) {
    return token.toLowerCase() === this.config.smartMAddress.toLowerCase();
  }

  is_usualM(token: string) {
    return token.toLowerCase() === this.config.usualMAddress.toLowerCase();
  }

  is_usualM_swap_token(srcToken: string, destToken: string) {
    return this.is_smartM(srcToken) && this.is_usualM(destToken);
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

    if (this.is_usualM_swap_token(srcTokenAddress, destTokenAddress)) {
      return [`${this.dexKey}_${this.config.usualMAddress}`];
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
  ): Promise<null | ExchangePrices<UsualMSmartMData>> {
    if (side === SwapSide.BUY) {
      return null;
    }

    const isUsualMSwapToken = this.is_usualM_swap_token(
      srcToken.address,
      destToken.address,
    );

    if (!isUsualMSwapToken) {
      return null;
    }

    const unitOut = BI_POWS[18]; // 1:1 swap
    const amountsOut = amounts; // 1:1 swap, so output amounts are the same as input

    return [
      {
        unit: unitOut,
        prices: amountsOut,
        data: {},
        poolAddresses: [this.config.usualMAddress],
        exchange: this.dexKey,
        gasCost: 70000,
        poolIdentifier: this.dexKey,
      },
    ];
  }

  getCalldataGasCost(
    poolPrices: PoolPrices<UsualMSmartMData>,
  ): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UsualMSmartMData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload = '0x';

    return {
      targetExchange: this.config.usualMAddress,
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
    data: UsualMSmartMData,
    side: SwapSide,
  ): Promise<DexExchangeParam> {
    if (this.is_smartM(srcToken) && this.is_usualM(destToken)) {
      const exchangeData = this.usualMIface.encodeFunctionData('wrap', [
        recipient,
        srcAmount,
      ]);

      return {
        needWrapNative: false,
        dexFuncHasRecipient: true,
        exchangeData,
        targetExchange: this.config.usualMAddress,
        returnAmountPos: undefined,
      };
    }

    throw new Error('LOGIC ERROR');
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const isSmartM = this.is_smartM(tokenAddress);
    if (!isSmartM && !this.is_usualM(tokenAddress)) return [];

    return [
      {
        exchange: this.dexKey,
        address: this.config.usualMAddress,
        connectorTokens: [
          {
            decimals: 6,
            address: isSmartM
              ? this.config.usualMAddress
              : this.config.smartMAddress,
          },
        ],
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
    ];
  }
}
