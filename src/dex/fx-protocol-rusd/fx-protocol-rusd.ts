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
import { DexParams, FxProtocolData, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { FxProtocolConfig, Adapters } from './config';
import { Interface } from '@ethersproject/abi';
import FxUSD_ABI from '../../abi/fx-protocol/FxUSD.json';
import { uint256ToBigInt } from '../../lib/decoders';
import { extractReturnAmountPosition } from '../../executor/utils';
import { getBigNumberPow } from '../../bignumber-constants';
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
  static readonly fxUSDIface = new Interface(FxUSD_ABI);

  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = true;

  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(FxProtocolConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    const config = FxProtocolConfig[dexKey][network];
    this.config = {
      rUSDAddress: config.rUSDAddress.toLowerCase(),
      weETHAddress: config.weETHAddress.toLowerCase(),
      ezETHAddress: config.ezETHAddress.toLowerCase(),
    };
    this.logger = dexHelper.getLogger(dexKey);
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

  is_ezETH(token: string) {
    return token.toLowerCase() === this.config.ezETHAddress;
  }

  is_rUSD_swap_token(srcToken: string, destToken: string) {
    if (this.is_weETH(srcToken) && this.is_rUSD(destToken)) {
      return true;
    }
    if (this.is_rUSD(srcToken) && this.is_weETH(destToken)) {
      return true;
    }
    if (this.is_rUSD(srcToken) && this.is_ezETH(destToken)) {
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

  async getAmountOut(
    _tokenIn: Token,
    _tokenOut: Token,
    _amountsIn: bigint[],
    blockNumber: number,
  ): Promise<bigint[]> {
    const is_weETH_src = this.is_weETH(_tokenIn.address);
    const weETHUsdPrice = await this.dexHelper.getTokenUSDPrice(
      {
        address: this.config.weETHAddress,
        decimals: 18,
      },
      BigInt(getBigNumberPow(_tokenOut.decimals).toFixed(0)),
    );

    const readerCallData = [
      {
        target: this.config.rUSDAddress,
        callData: FxProtocolRusd.fxUSDIface.encodeFunctionData('nav', []),
        decodeFunction: uint256ToBigInt,
      },
    ];
    const results = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
      true,
      readerCallData,
      blockNumber,
    );
    let _amountsOut;
    if (is_weETH_src) {
      _amountsOut = _amountsIn.map(_amountIn =>
        BigInt(
          (BigInt(weETHUsdPrice) * _amountIn) /
            BigInt(results[0].returnData) /
            BI_POWS[18],
        ),
      );
    } else {
      _amountsOut = _amountsIn.map(_amountIn =>
        BigInt(
          ((BigInt(results[0].returnData) / BigInt(weETHUsdPrice)) *
            _amountIn) /
            BI_POWS[18],
        ),
      );
    }
    return _amountsOut;
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

    const prices = await this.getAmountOut(
      srcToken,
      destToken,
      amounts,
      blockNumber,
    );

    return [
      {
        unit: 1000000000000000000n,
        prices,
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
      const exchangeData = FxProtocolRusd.fxUSDIface.encodeFunctionData(
        'mint',
        [
          this.config.weETHAddress,
          srcAmount,
          this.dexHelper.config.data.augustusAddress!,
          '0',
        ],
      );
      return {
        needWrapNative: false,
        dexFuncHasRecipient: false,
        exchangeData,
        targetExchange: this.config.rUSDAddress,
        returnAmountPos: extractReturnAmountPosition(
          FxProtocolRusd.fxUSDIface,
          'mint',
          '_amountOut',
        ),
      };
    }
    if (is_rUSD_src && is_weETH_dest) {
      const exchangeData = FxProtocolRusd.fxUSDIface.encodeFunctionData(
        'redeem',
        [
          destToken,
          srcAmount,
          this.dexHelper.config.data.augustusAddress!,
          '0',
        ],
      );
      return {
        needWrapNative: false,
        dexFuncHasRecipient: false,
        exchangeData,
        targetExchange: this.config.rUSDAddress,
        returnAmountPos: extractReturnAmountPosition(
          FxProtocolRusd.fxUSDIface,
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
