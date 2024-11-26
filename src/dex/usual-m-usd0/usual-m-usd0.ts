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
import { UsualMUsd0Data, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { UsualMUsd0Config } from './config';
import { Interface, JsonFragment } from '@ethersproject/abi';
import USUAL_DAO_COLLATERAL_ABI from '../../abi/usual-m-usd0/usualCollateralDao.abi.json';
import { BI_POWS } from '../../bigint-constants';

export class UsualMUsd0 extends SimpleExchange implements IDex<UsualMUsd0Data> {
  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = true;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UsualMUsd0Config);

  usualDaoCollateralIface: Interface;
  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    super(dexHelper, dexKey);
    const config = UsualMUsd0Config[dexKey][network];
    this.usualDaoCollateralIface = new Interface(
      USUAL_DAO_COLLATERAL_ABI as JsonFragment[],
    );
    this.config = {
      usualMAddress: config.usualMAddress.toLowerCase(),
      usd0Address: config.usd0Address.toLowerCase(),
    };
    this.logger = dexHelper.getLogger(dexKey);
  }

  async initializePricing(blockNumber: number) {
    // No initialization needed for constant price
  }

  getConfig() {
    return this.config;
  }

  is_usualM(token: string) {
    return token.toLowerCase() === this.config.usualMAddress.toLowerCase();
  }

  is_usd0(token: string) {
    return token.toLowerCase() === this.config.usd0Address.toLowerCase();
  }

  is_usd0_swap_token(srcToken: string, destToken: string) {
    return this.is_usualM(srcToken) && this.is_usd0(destToken);
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
      return [`${this.dexKey}_${this.config.usd0Address}`];
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
  ): Promise<null | ExchangePrices<UsualMUsd0Data>> {
    // TODO: check is SwapSide is required
    // if (side === SwapSide.BUY) {
    //   return null;
    // }

    const isUsd0SwapToken = this.is_usd0_swap_token(
      srcToken.address,
      destToken.address,
    );

    if (!isUsd0SwapToken) {
      return null;
    }

    const unitOut = BI_POWS[18]; // 1:1 swap
    const amountsOut = amounts; // 1:1 swap, so output amounts are the same as input

    return [
      {
        unit: unitOut,
        prices: amountsOut,
        data: {},
        poolAddresses: [this.config.usd0Address],
        exchange: this.dexKey,
        gasCost: 70000,
        poolIdentifier: this.dexKey,
      },
    ];
  }

  getCalldataGasCost(
    poolPrices: PoolPrices<UsualMUsd0Data>,
  ): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UsualMUsd0Data,
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
    data: UsualMUsd0Data,
    side: SwapSide,
  ): Promise<DexExchangeParam> {
    if (this.is_usualM(srcToken) && this.is_usd0(destToken)) {
      const exchangeData = this.usualDaoCollateralIface.encodeFunctionData(
        'swap',
        [srcToken, srcAmount, destAmount],
      );

      return {
        needWrapNative: false,
        dexFuncHasRecipient: false,
        exchangeData,
        targetExchange: this.config.usualDaoCollateralAddress,
        returnAmountPos: undefined,
      };
    }

    throw new Error('LOGIC ERROR');
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const isUsualM = this.is_usualM(tokenAddress);
    if (!isUsualM && !this.is_usd0(tokenAddress)) return [];

    return [
      {
        exchange: this.dexKey,
        address: this.config.usualMAddress,
        connectorTokens: [
          {
            decimals: isUsualM ? 6 : 18, // TODO: check this one
            address: isUsualM
              ? this.config.usd0Address
              : this.config.usualMAddress,
          },
        ],
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
    ];
  }
}
