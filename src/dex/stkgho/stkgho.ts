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
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DexParams, PoolState, StkGHOData } from './types';
import { SimpleExchange } from '../simple-exchange';
import { StkGHOConfig, Adapters } from './config';
import { StkGHOEventPool } from './stkgho-pool';
import { Interface } from '@ethersproject/abi';
import StkGHO_ABI from '../../abi/stkGHO.json';

export class StkGHO extends SimpleExchange implements IDex<StkGHOData> {
  static readonly stkGHOInterface = new Interface(StkGHO_ABI);
  protected eventPool: StkGHOEventPool;

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  protected config: DexParams;

  readonly isFeeOnTransferSupported = false;
  readonly exchangeRateUnit = 1_000_000_000_000_000_000n;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(StkGHOConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPool = new StkGHOEventPool(
      dexKey,
      dexKey,
      network,
      dexHelper,
      this.logger,
    );

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
    const state = await this.eventPool.generateState(blockNumber);

    this.eventPool.initialize(blockNumber, {
      state,
    });
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

  async getPoolState(blockNumber: number): Promise<PoolState> {
    const eventState = this.eventPool.getState(blockNumber);
    if (eventState) return eventState;
    const onChainState = await this.eventPool.generateState(blockNumber);
    this.eventPool.setState(onChainState, blockNumber);
    return onChainState;
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

    const state = await this.getPoolState(blockNumber);

    return [
      {
        unit: state.exchangeRate,
        prices: amounts.map(
          amount => (state.exchangeRate * amount) / this.exchangeRateUnit,
        ),
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

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {}

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
          liquidityUSD: 1_000_000_000_000, // GHO to stkGHO supply is unlimited
        },
      ];
    } else {
      return [];
    }
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}
}
