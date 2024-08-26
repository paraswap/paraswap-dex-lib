import { AsyncOrSync } from 'ts-essentials';
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
import { DexParams, StkGHOData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { StkGHOConfig, Adapters } from './config';
import { Interface, parseUnits } from 'ethers/lib/utils';
import { uint256ToBigInt } from '../../lib/decoders';
import StkGHO_ABI from '../../abi/stkGHO.json';

export class StkGHO extends SimpleExchange implements IDex<StkGHOData> {
  static readonly stkGHOInterface = new Interface(StkGHO_ABI);
  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = false;

  protected config: DexParams;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(StkGHOConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);

    const config = StkGHOConfig[dexKey][network];
    this.config = {
      stkGHO: config.stkGHO.toLowerCase(),
      GHO: config.GHO.toLowerCase(),
    };
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // TODO: complete me!
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
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();

    if (
      srcTokenAddress === this.config.GHO &&
      destTokenAddress === this.config.stkGHO
    ) {
      return [`${this.dexKey}`];
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
  ): Promise<null | ExchangePrices<StkGHOData>> {
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();

    if (
      srcTokenAddress != this.config.GHO ||
      destTokenAddress != this.config.stkGHO
    ) {
      return null;
    }

    const unit = parseUnits('1', srcToken.decimals).toBigInt();

    const amountsWithUnit = [...amounts, unit];

    const calls = amountsWithUnit.map(amount => ({
      target: this.config.stkGHO,
      callData: StkGHO.stkGHOInterface.encodeFunctionData('previewStake', [
        amount,
      ]),
      decodeFunction: uint256ToBigInt,
    }));

    let results = await this.dexHelper.multiWrapper.tryAggregate<bigint>(
      true,
      calls,
      blockNumber,
    );

    const unitPriceResult = results.pop()!;

    return [
      {
        unit: unitPriceResult.returnData,
        prices: results.map(result => result.returnData),
        data: {
          exchange: this.dexKey,
        },
        poolAddresses: ['this.config.stkGHO'],
        exchange: this.dexKey,
        gasCost: 100_000,
        poolIdentifier: `${this.dexKey}`,
      },
    ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<StkGHOData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
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
    data: StkGHOData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
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
    data: StkGHOData,
    side: SwapSide,
  ): Promise<DexExchangeParam> {
    const exchangeData = StkGHO.stkGHOInterface.encodeFunctionData('stake', [
      recipient,
      srcAmount,
    ]);

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData,
      targetExchange: this.config.stkGHO,
      returnAmountPos: undefined,
    };
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    tokenAddress = tokenAddress.toLowerCase();

    if (tokenAddress == this.config.GHO) {
      return [
        {
          exchange: this.dexKey,
          address: this.config.stkGHO,
          connectorTokens: [
            {
              decimals: 18,
              address: this.config.stkGHO,
            },
          ],
          liquidityUSD: 1000000000, // Just returning a big number so this DEX will be preferred
        },
      ];
    } else {
      return [];
    }
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
