import { AsyncOrSync, assert } from 'ts-essentials';
import { BigNumber, BytesLike, ethers } from 'ethers';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  NumberAsString,
  DexExchangeParam,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { Utils, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DexParams, FxProtocolData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { FxProtocolConfig, Adapters } from './config';
import { Interface, JsonFragment } from '@ethersproject/abi';
import FxUSD_ABI from '../../abi/fx-protocol/FxUSD.json';
import FxMarket_ABI from '../../abi/fx-protocol/FxMarket.json';
import EthWeETHOralce_ABI from '../../abi/fx-protocol/weETHOralce.json';

import { uint256ToBigInt } from '../../lib/decoders';
import { extractReturnAmountPosition } from '../../executor/utils';
import { getBigNumberPow } from '../../bignumber-constants';
import { fxProtocolRusdEvent } from './fx-protocol-rusd-event';
import { MultiResult } from '../../lib/multi-wrapper';
import {
  addressDecode,
  generalDecoder,
  uint256DecodeToNumber,
  uint8ToNumber,
} from '../../lib/decoders';
import { bool } from 'joi';
import { BI_POWS } from '../../bigint-constants';

export class FxProtocolRusd
  extends SimpleExchange
  implements IDex<FxProtocolData>
{
  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = true;

  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(FxProtocolConfig);

  fxUSDIface: Interface;
  rUSDMarketIface: Interface;
  weETHOracleIface: Interface;
  fxProtocolRusdPool: fxProtocolRusdEvent;
  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    const config = FxProtocolConfig[dexKey][network];
    this.fxUSDIface = new Interface(FxUSD_ABI as JsonFragment[]);
    this.rUSDMarketIface = new Interface(FxMarket_ABI as JsonFragment[]);
    this.weETHOracleIface = new Interface(EthWeETHOralce_ABI as JsonFragment[]);
    this.config = {
      rUSDAddress: config.rUSDAddress.toLowerCase(),
      weETHAddress: config.weETHAddress.toLowerCase(),
      rUSDWeETHMarketAddress: config.rUSDWeETHMarketAddress.toLowerCase(),
      weETHOracleAddress: config.weETHOracleAddress.toLowerCase(),
    };
    this.logger = dexHelper.getLogger(dexKey);
    this.fxProtocolRusdPool = new fxProtocolRusdEvent(
      this.dexKey,
      dexHelper,
      this.config.rUSDAddress,
      this.fxUSDIface,
      this.config.rUSDWeETHMarketAddress,
      this.rUSDMarketIface,
      this.config.weETHOracleAddress,
      this.weETHOracleIface,
      this.logger,
    );
  }

  async initializePricing(blockNumber: number) {
    const data: { returnData: any[] } =
      await this.dexHelper.multiContract.methods
        .aggregate([
          {
            target: this.config.rUSDWeETHMarketAddress,
            callData: this.rUSDMarketIface.encodeFunctionData(
              'fTokenRedeemFeeRatio',
              [],
            ),
          },
          {
            target: this.config.weETHOracleAddress,
            callData: this.weETHOracleIface.encodeFunctionData(
              'latestAnswer',
              [],
            ),
          },
        ])
        .call({}, blockNumber);

    const redeemFee = BigInt(
      this.rUSDMarketIface.decodeFunctionResult(
        'fTokenRedeemFeeRatio',
        data.returnData[0],
      )[0],
    );
    const weETHPrice = BigInt(
      this.weETHOracleIface.decodeFunctionResult(
        'latestAnswer',
        data.returnData[1],
      )[0],
    );
    await Promise.all([
      this.fxProtocolRusdPool.initialize(blockNumber, {
        state: {
          nav: 1000000000000000000n,
          redeemFee,
          weETHPrice,
        },
      }),
    ]);
  }

  getConfig() {
    return this.config;
  }

  is_weETH(token: string) {
    return token.toLowerCase() === this.config.weETHAddress;
  }

  is_rUSD(token: string) {
    return token.toLowerCase() === this.config.rUSDAddress;
  }

  is_rUSD_swap_token(srcToken: string, destToken: string) {
    if (this.is_weETH(srcToken) && this.is_rUSD(destToken)) {
      return true;
    }
    if (this.is_rUSD(srcToken) && this.is_weETH(destToken)) {
      return true;
    }
    return false;
  }
  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (!this.is_rUSD_swap_token(srcToken.address, destToken.address)) {
      return [];
    }
    return [this.dexKey];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<FxProtocolData>> {
    const isRUSDSwapToken = this.is_rUSD_swap_token(
      srcToken.address,
      destToken.address,
    );
    if (!isRUSDSwapToken) {
      return null;
    }
    const pool = this.fxProtocolRusdPool;
    if (!pool.getState(blockNumber)) return null;

    const is_redeem = this.is_weETH(destToken.address);
    const unitIn = BI_POWS[18];
    const unitOut = pool.getPrice(blockNumber, unitIn, is_redeem);
    const amountsOut = amounts.map(_amountIn =>
      pool.getPrice(blockNumber, _amountIn, is_redeem),
    );

    return [
      {
        unit: unitOut,
        prices: amountsOut,
        data: {},
        poolAddresses: [this.config.rUSDAddress],
        exchange: this.dexKey,
        gasCost: 1000000,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<FxProtocolData>,
  ): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // V5: Used for multiSwap, buy & megaSwap
  // V6: Not used, can be left blank
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: FxProtocolData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload = '0x';

    return {
      targetExchange: this.config.rUSDAddress,
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
    data: FxProtocolData,
    side: SwapSide,
  ): Promise<DexExchangeParam> {
    const is_rUSD_src = this.is_rUSD(srcToken);
    const is_weETH_src = this.is_weETH(srcToken);
    const is_rUSD_dest = this.is_rUSD(destToken);
    const is_weETH_dest = this.is_weETH(destToken);

    if (is_weETH_src && is_rUSD_dest) {
      const exchangeData = this.fxUSDIface.encodeFunctionData('mint', [
        this.config.weETHAddress,
        srcAmount,
        this.dexHelper.config.data.executorsAddresses?.Executor01,
        '0',
      ]);
      return {
        needWrapNative: false,
        dexFuncHasRecipient: false,
        exchangeData,
        targetExchange: this.config.rUSDAddress,
        returnAmountPos: extractReturnAmountPosition(
          this.fxUSDIface,
          'mint',
          '_amountOut',
        ),
      };
    }
    if (is_rUSD_src && is_weETH_dest) {
      const exchangeData = this.fxUSDIface.encodeFunctionData('redeem', [
        this.config.weETHAddress,
        srcAmount,
        this.dexHelper.config.data.executorsAddresses?.Executor01,
        '0',
      ]);
      return {
        needWrapNative: false,
        dexFuncHasRecipient: false,
        exchangeData,
        targetExchange: this.config.rUSDAddress,
        returnAmountPos: extractReturnAmountPosition(
          this.fxUSDIface,
          'redeem',
          '_amountOut',
        ),
      };
    }
    throw new Error('LOGIC ERROR');
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    return [
      {
        exchange: this.dexKey,
        address: this.config.rUSDAddress,
        connectorTokens: [
          {
            decimals: 18,
            address: this.config.rUSDAddress,
          },
        ],
        liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
      },
    ];
  }
}
