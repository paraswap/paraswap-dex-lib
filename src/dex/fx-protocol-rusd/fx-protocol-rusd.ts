import { AsyncOrSync, assert } from 'ts-essentials';
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

  private state: { blockNumber: number } & PoolState = {
    blockNumber: 0,
    nav: 0n,
  };

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

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
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
    if (!this.is_rUSD_swap_token(srcToken.address, destToken.address)) {
      return [];
    }
    return [this.dexKey];
  }

  // // Returns pool prices for amounts.
  // // If limitPools is defined only pools in limitPools
  // // should be used. If limitPools is undefined then
  // // any pools can be used.
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
    const readerCallData = [
      {
        target: this.config.rUSDAddress,
        callData: FxProtocolRusd.fxUSDIface.encodeFunctionData('nav'),
        decodeFunction: uint256ToBigInt,
      },
    ];
    // const readerResult = (
    //   await this.dexHelper.multiContract.methods
    //     .aggregate(readerCallData)
    //     .call({}, blockNumber)
    // ).returnData;

    // const results = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
    //   true,
    //   readerCallData,
    //   blockNumber,
    // );

    // const _price = results[0].returnData;
    return [
      {
        unit: 1000000000000000000n,
        prices: amounts,
        data: {},
        poolAddresses: [this.config.rUSDAddress],
        exchange: this.dexKey,
        gasCost: 70000,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<FxProtocolData>,
  ): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

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
    const is_eETH_dest = this.is_ezETH(destToken);

    if (is_weETH_src && is_rUSD_dest) {
      assert(this.is_weETH(srcToken), 'srcToken should be weETH');
      const exchangeData = FxProtocolRusd.fxUSDIface.encodeFunctionData(
        'mint',
        [this.config.weETHAddress, srcAmount, recipient, '0'],
      );
      return {
        needWrapNative: false,
        dexFuncHasRecipient: true,
        exchangeData,
        targetExchange: this.config.rUSDAddress,
        returnAmountPos: extractReturnAmountPosition(
          FxProtocolRusd.fxUSDIface,
          'mint',
          '_amountOut',
        ),
      };
    }
    if (is_rUSD_src && (is_weETH_dest || is_eETH_dest)) {
      assert(this.is_rUSD(srcToken), 'srcToken should be rUSD');
      const exchangeData = FxProtocolRusd.fxUSDIface.encodeFunctionData(
        'redeem',
        [destToken, srcAmount, recipient, '0'],
      );
      return {
        needWrapNative: false,
        dexFuncHasRecipient: true,
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
