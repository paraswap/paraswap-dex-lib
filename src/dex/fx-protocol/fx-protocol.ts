import { AsyncOrSync } from 'ts-essentials';
import { Interface } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { FxProtocolData, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { FxProtocolConfig, Adapters } from './config';
import { BI_POWS } from '../../bigint-constants';

import FractionalTokenABI from '../../abi/fx-protocol/FractionalToken.json';
import LeveragedTokenABI from '../../abi/fx-protocol/LeveragedToken.json';
import MarketABI from '../../abi/fx-protocol/Market.json';
import stETHTreasuryABI from '../../abi/fx-protocol/stETHTreasury.json';

import { error } from 'console';

export class FxProtocol extends SimpleExchange implements IDex<FxProtocolData> {
  static readonly fETHIface = new Interface(FractionalTokenABI);
  static readonly xETHIface = new Interface(LeveragedTokenABI);
  static readonly MarketIface = new Interface(MarketABI);
  static readonly stETHTreasuryIface = new Interface(stETHTreasuryABI);
  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = true;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(FxProtocolConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected unitPrice = BI_POWS[18],
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
    protected params: DexParams = FxProtocolConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.config = params;
    this.logger = dexHelper.getLogger(dexKey);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  isfETH(tokenAddress: Address) {
    return this.config.fETH.toLowerCase() === tokenAddress.toLowerCase();
  }
  isxETH(tokenAddress: Address) {
    return this.config.xETH.toLowerCase() === tokenAddress.toLowerCase();
  }
  isstETH(tokenAddress: Address) {
    return this.config.stETH.toLowerCase() === tokenAddress.toLowerCase();
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
    error('srcToken', srcToken);
    if (
      (this.isstETH(srcToken.address) && this.isfETH(destToken.address)) ||
      (this.isstETH(srcToken.address) && this.isxETH(destToken.address))
    ) {
      return [`${this.dexKey}_${this.network}_${destToken.address}`];
    } else {
      return [];
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
  ): Promise<null | ExchangePrices<FxProtocolData>> {
    const _isFXSwap =
      (this.isstETH(srcToken.address) && this.isfETH(destToken.address)) ||
      (this.isstETH(srcToken.address) && this.isxETH(destToken.address));
    if (!_isFXSwap) return null;
    return [
      {
        unit: this.unitPrice,
        prices: amounts,
        data: {},
        poolAddresses: [this.config.fETH],
        exchange: this.dexKey,
        gasCost: 70000,
        poolIdentifier: `${this.dexKey}_${this.network}_${this.config.fETH}`,
      },
      {
        unit: this.unitPrice,
        prices: amounts,
        data: {},
        poolAddresses: [this.config.xETH],
        exchange: this.dexKey,
        gasCost: 70000,
        poolIdentifier: `${this.dexKey}_${this.network}_${this.config.xETH}`,
      },
    ];
  }

  getCalldataGasCost(
    poolPrices: PoolPrices<FxProtocolData>,
  ): number | number[] {
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
    data: FxProtocolData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // Encode here the payload for adapter
    const payload = '0x';

    return {
      targetExchange: this.config.market,
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
    data: FxProtocolData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (this.isstETH(srcToken) && this.isfETH(destToken)) {
      const approveParam = await this.getApproveSimpleParam(
        this.config.stETH,
        this.config.market,
        srcAmount,
      );
      return {
        callees: [...approveParam.callees, this.config.market],
        calldata: [
          ...approveParam.calldata,
          FxProtocol.MarketIface.encodeFunctionData('mintFToken', [
            srcAmount,
            this.augustusAddress,
            '0',
          ]),
        ],
        values: [...approveParam.values, '0'],
        networkFee: '0',
      };
    } else {
      const approveParam = await this.getApproveSimpleParam(
        this.config.stETH,
        this.config.market,
        srcAmount,
      );
      return {
        callees: [...approveParam.callees, this.config.market],
        calldata: [
          ...approveParam.calldata,
          FxProtocol.MarketIface.encodeFunctionData('mintXToken', [
            srcAmount,
            this.augustusAddress,
            '0',
          ]),
        ],
        values: [...approveParam.values, '0'],
        networkFee: '0',
      };
    }
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
