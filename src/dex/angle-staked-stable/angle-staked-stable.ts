import { Interface } from '@ethersproject/abi';
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
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AngleStakedStableData, DexParams, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { AngleStakedStableConfig, Adapters } from './config';
import { AngleStakedStableEventPool } from './angle-staked-stable-pool';
import StakedStableABI from '../../abi/angle/stagToken.json';

const AngleStakedGasCost = 0;

export class AngleStakedStable
  extends SimpleExchange
  implements IDex<AngleStakedStableData>
{
  static readonly wstETHIface = new Interface(StakedStableABI);
  protected config: DexParams;

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AngleStakedStableConfig);

  logger: Logger;

  protected eventPools: AngleStakedStableEventPool | null = null;
  protected isPaused: boolean = false;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
  ) {
    super(dexHelper, dexKey);
    const config = AngleStakedStableConfig[dexKey][network];
    this.logger = dexHelper.getLogger(dexKey);
    this.config = {
      stEUR: config.stEUR.toLowerCase(),
      agEUR: config.agEUR.toLowerCase(),
    };
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    this.eventPools = new AngleStakedStableEventPool(
      this.dexKey,
      this.network,
      this.dexHelper,
      this.logger,
      this.config,
    );
    await this.eventPools.initialize(blockNumber);
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
    if (!this._knownAddress(srcToken, destToken)) return [];
    else return [this.dexKey];
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
  ): Promise<null | ExchangePrices<AngleStakedStableData>> {
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (!this._knownAddress(srcToken, destToken)) return null;

    const state = this.eventPools?.getState(blockNumber);
    if (this.eventPools === null || state === undefined || state === null)
      return null;
    if (srcTokenAddress === this.config.agEUR && side === SwapSide.SELL)
      return [
        {
          prices: amounts.map(amount =>
            this.eventPools!.getRateDeposit(amount, state),
          ),
          unit: this.eventPools.getRateDeposit(1n * BigInt(10 ** 18), state),
          gasCost: AngleStakedGasCost,
          exchange: this.dexKey,
          data: { exchange: `${this.config.stEUR}` },
          poolAddresses: [`${this.config.stEUR}_${this.config.agEUR}`],
        },
      ];
    else if (destTokenAddress === this.config.agEUR && side === SwapSide.SELL)
      return [
        {
          prices: amounts.map(share =>
            this.eventPools!.getRateRedeem(share, state),
          ),
          unit: this.eventPools.getRateRedeem(1n * BigInt(10 ** 18), state),
          gasCost: AngleStakedGasCost,
          exchange: this.dexKey,
          data: { exchange: `${this.config.stEUR}` },
          poolAddresses: [`${this.config.stEUR}_${this.config.agEUR}`],
        },
      ];
    else if (srcTokenAddress === this.config.agEUR && side === SwapSide.BUY)
      return [
        {
          prices: amounts.map(share =>
            this.eventPools!.getRateMint(share, state),
          ),
          unit: this.eventPools.getRateMint(1n * BigInt(10 ** 18), state),
          gasCost: AngleStakedGasCost,
          exchange: this.dexKey,
          data: { exchange: `${this.config.stEUR}` },
          poolAddresses: [`${this.config.stEUR}_${this.config.agEUR}`],
        },
      ];
    else
      return [
        {
          prices: amounts.map(amount =>
            this.eventPools!.getRateWithdraw(amount, state),
          ),
          unit: this.eventPools.getRateWithdraw(1n * BigInt(10 ** 18), state),
          gasCost: AngleStakedGasCost,
          exchange: this.dexKey,
          data: { exchange: `${this.config.stEUR}` },
          poolAddresses: [`${this.config.stEUR}_${this.config.agEUR}`],
        },
      ];
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<AngleStakedStableData>,
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
    data: AngleStakedStableData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
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
    data: AngleStakedStableData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { exchange } = data;

    // Encode here the transaction arguments
    const swapData =
      srcToken.toLowerCase() === this.config.agEUR
        ? AngleStakedStableEventPool.angleStakedStableIface.encodeFunctionData(
            side === SwapSide.SELL ? 'deposit' : 'mint',
            [
              side === SwapSide.SELL ? srcAmount : destAmount,
              this.augustusAddress,
            ],
          )
        : AngleStakedStableEventPool.angleStakedStableIface.encodeFunctionData(
            side === SwapSide.SELL ? 'redeem' : 'withdraw',
            [
              side === SwapSide.SELL ? srcAmount : destAmount,
              this.augustusAddress,
              this.augustusAddress,
            ],
          );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    const tokenBalanceMultiCall = [
      {
        target: this.config.stEUR,
        callData:
          AngleStakedStableEventPool.angleStakedStableIface.encodeFunctionData(
            'paused',
          ),
      },
    ];
    const returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(tokenBalanceMultiCall)
        .call()
    ).returnData;

    this.isPaused =
      AngleStakedStableEventPool.angleStakedStableIface.decodeFunctionResult(
        'paused',
        returnData[0],
      )[0] as boolean;
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (
      this.isPaused ||
      (tokenAddress.toLowerCase() != this.config.agEUR &&
        tokenAddress.toLowerCase() != this.config.stEUR)
    )
      return [];
    else
      return [
        {
          exchange: this.dexKey,
          address: this.config.stEUR,
          connectorTokens: [
            tokenAddress.toLowerCase() == this.config.agEUR
              ? ({ address: this.config.stEUR, decimals: 18 } as Token)
              : ({ address: this.config.agEUR, decimals: 18 } as Token),
          ],
          // liquidity is infinite as to have been able to mint stEUR, you must have deposited agEUR
          liquidityUSD: 1e12,
        },
      ];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}

  _knownAddress(srcToken: Token, destToken: Token): boolean {
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (
      !(
        (srcTokenAddress === this.config.agEUR &&
          destTokenAddress === this.config.stEUR) ||
        (srcTokenAddress === this.config.stEUR &&
          destTokenAddress === this.config.agEUR)
      )
    ) {
      return false;
    }
    return true;
  }
}
