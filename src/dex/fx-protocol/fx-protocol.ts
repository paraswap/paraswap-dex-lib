import { AsyncOrSync } from 'ts-essentials';
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
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DexParams, FxProtocolData, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { FxProtocolConfig, Adapters } from './config';
import { Interface } from '@ethersproject/abi';
import FxUSD_ABI from '../../abi/fx-protocol/FxUSD.json';
import { uint256ToBigInt } from '../../lib/decoders';
import { extractReturnAmountPosition } from '../../executor/utils';

export class FxProtocol extends SimpleExchange implements IDex<FxProtocolData> {
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
    };
    this.logger = dexHelper.getLogger(dexKey);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
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
    if (side === SwapSide.BUY) return [];
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (
      !(
        srcTokenAddress === this.config.weETHAddress &&
        destTokenAddress === this.config.rUSDAddress
      )
    ) {
      return [];
    }
    return [this.dexKey];
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
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (
      !(
        srcTokenAddress === this.config.weETHAddress &&
        destTokenAddress === this.config.rUSDAddress
      )
    ) {
      return null;
    }
    const readerCallData = [
      {
        target: this.config.rUSDAddress,
        callData: FxProtocol.fxUSDIface.encodeFunctionData('nav'),
        decodeFunction: uint256ToBigInt,
      },
    ];
    // const readerResult = (
    //   await this.dexHelper.multiContract.methods
    //     .aggregate(readerCallData)
    //     .call({}, blockNumber)
    // ).returnData;

    const results = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
      true,
      readerCallData,
      blockNumber,
    );

    const _price = results[0].returnData;
    this.state = {
      blockNumber,
      nav: results[0].returnData,
    };

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      'state',
      60,
      Utils.Serialize(this.state),
    );

    return [
      {
        unit: 1000000000000000000n,
        prices: amounts.map(item => (item * _price) / 1000000000000000000n),
        data: {},
        poolAddresses: [this.config.rUSDAddress],
        exchange: this.dexKey,
        gasCost: 70000,
        poolIdentifier: `${this.dexKey}_${this.network}_${this.config.weETHAddress}`,
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
    if (srcToken.toLowerCase() === this.config.weETHAddress) {
      const approveParam = await this.getApproveSimpleParam(
        this.config.weETHAddress,
        this.config.rUSDAddress,
        srcAmount,
      );
      return {
        callees: [...approveParam.callees, this.config.rUSDAddress],
        calldata: [
          ...approveParam.calldata,
          FxProtocol.fxUSDIface.encodeFunctionData('mint', [
            this.config.weETHAddress,
            srcAmount,
            this.augustusAddress,
            '0',
          ]),
        ],
        values: [...approveParam.values, '0'],
        networkFee: '0',
      };
    }
    throw new Error('LOGIC ERROR');
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
    const exchangeData = FxProtocol.fxUSDIface.encodeFunctionData('mint', [
      this.config.weETHAddress,
      srcAmount,
      this.augustusAddress,
      '0',
    ]);

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: false,
      exchangeData,
      targetExchange: this.config.rUSDAddress,
      returnAmountPos:
        side === SwapSide.SELL
          ? extractReturnAmountPosition(
              FxProtocol.fxUSDIface,
              'mint',
              '_amountOut',
            )
          : undefined,
    };
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    tokenAddress = tokenAddress.toLowerCase();
    if (tokenAddress !== this.config.weETHAddress) {
      return [];
    }
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
