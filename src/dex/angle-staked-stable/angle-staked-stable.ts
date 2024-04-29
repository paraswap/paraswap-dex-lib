import { Interface } from '@ethersproject/abi';
import type { AsyncOrSync } from 'ts-essentials';
import type {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, type Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import type { IDex } from '../../dex/idex';
import type { IDexHelper } from '../../dex-helper/idex-helper';
import type { AngleStakedStableData, DexParams } from './types';
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

  protected eventPools: { [key: string]: AngleStakedStableEventPool } = {};
  protected isPaused: { [key: string]: boolean } = {};

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
      EURA: config.EURA.toLowerCase(),
      stUSD: config.stUSD.toLowerCase(),
      USDA: config.USDA.toLowerCase(),
    };
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    this.eventPools[this.config.stEUR] = new AngleStakedStableEventPool(
      `${this.dexKey}_${this.config.stEUR!.toLowerCase()}`,
      this.network,
      this.dexHelper,
      this.config.stEUR,
      this.config.EURA,
      this.logger,
    );
    await this.eventPools[this.config.stEUR].initialize(blockNumber);

    this.eventPools[this.config.stUSD] = new AngleStakedStableEventPool(
      `${this.dexKey}_${this.config.stUSD!.toLowerCase()}`,
      this.network,
      this.dexHelper,
      this.config.stUSD,
      this.config.USDA,
      this.logger,
    );
    await this.eventPools[this.config.stUSD].initialize(blockNumber);
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
    const knownInfo = this._knownAddress(srcToken, destToken);
    if (!knownInfo.known) return [];
    return [`${this.dexKey}_${knownInfo.stakeToken!.toLowerCase()}`];
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
    const knownInfo = this._knownAddress(srcToken, destToken);
    if (!knownInfo.known) return null;

    const agToken = knownInfo.agToken!;
    const stakeToken = knownInfo.stakeToken!;
    const eventPool = this.eventPools[stakeToken];
    const exchange = `${this.dexKey}`;
    // const exchange = `${this.dexKey}_${stakeToken.toLowerCase()}`;
    const state = eventPool?.getState(blockNumber);
    if (this.eventPools === null || state === undefined || state === null)
      return null;
    if (srcTokenAddress === agToken && side === SwapSide.SELL)
      return [
        {
          prices: amounts.map(amount =>
            eventPool.getRateDeposit(amount, state),
          ),
          unit: eventPool.getRateDeposit(1n * BigInt(10 ** 18), state),
          gasCost: AngleStakedGasCost,
          exchange: exchange,
          data: { exchange: `${stakeToken}` },
          poolAddresses: [`${stakeToken}`],
        },
      ];
    if (destTokenAddress === agToken && side === SwapSide.SELL)
      return [
        {
          prices: amounts.map(share => eventPool.getRateRedeem(share, state)),
          unit: eventPool.getRateRedeem(1n * BigInt(10 ** 18), state),
          gasCost: AngleStakedGasCost,
          exchange: exchange,
          data: { exchange: `${stakeToken}` },
          poolAddresses: [`${stakeToken}_${agToken}`],
        },
      ];
    if (srcTokenAddress === agToken && side === SwapSide.BUY)
      return [
        {
          prices: amounts.map(share => eventPool.getRateMint(share, state)),
          unit: eventPool.getRateMint(1n * BigInt(10 ** 18), state),
          gasCost: AngleStakedGasCost,
          exchange: exchange,
          data: { exchange: `${stakeToken}` },
          poolAddresses: [`${stakeToken}_${agToken}`],
        },
      ];
    return [
      {
        prices: amounts.map(amount => eventPool.getRateWithdraw(amount, state)),
        unit: eventPool.getRateWithdraw(1n * BigInt(10 ** 18), state),
        gasCost: AngleStakedGasCost,
        exchange: exchange,
        data: { exchange: `${stakeToken}` },
        poolAddresses: [`${stakeToken}_${agToken}`],
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

    return {
      targetExchange: exchange,
      payload: '0x',
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
      srcToken.toLowerCase() === this.config.EURA ||
      srcToken.toLowerCase() === this.config.USDA
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
      {
        target: this.config.stUSD,
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

    this.isPaused[this.config.stEUR] =
      AngleStakedStableEventPool.angleStakedStableIface.decodeFunctionResult(
        'paused',
        returnData[0],
      )[0] as boolean;
    this.isPaused[this.config.stUSD] =
      AngleStakedStableEventPool.angleStakedStableIface.decodeFunctionResult(
        'paused',
        returnData[1],
      )[0] as boolean;
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (
      (this.isPaused[this.config.stEUR] ||
        (tokenAddress.toLowerCase() !== this.config.EURA &&
          tokenAddress.toLowerCase() !== this.config.stEUR)) &&
      (this.isPaused[this.config.stUSD] ||
        (tokenAddress.toLowerCase() !== this.config.USDA &&
          tokenAddress.toLowerCase() !== this.config.stUSD))
    )
      return [];

    if (
      !(
        this.isPaused[this.config.stEUR] ||
        (tokenAddress.toLowerCase() !== this.config.EURA &&
          tokenAddress.toLowerCase() !== this.config.stEUR)
      )
    )
      return [
        {
          exchange: `${this.dexKey}_${this.config.stEUR!.toLowerCase()}`,
          address: this.config.stEUR,
          connectorTokens: [
            tokenAddress.toLowerCase() === this.config.EURA
              ? ({ address: this.config.stEUR, decimals: 18 } as Token)
              : ({ address: this.config.EURA, decimals: 18 } as Token),
          ],
          // liquidity is infinite as to have been able to mint stEUR, you must have deposited EURA
          liquidityUSD: 1e12,
        },
      ];
    return [
      {
        exchange: `${this.dexKey}_${this.config.stUSD!.toLowerCase()}`,
        address: this.config.stUSD,
        connectorTokens: [
          tokenAddress.toLowerCase() === this.config.USDA
            ? ({ address: this.config.stUSD, decimals: 18 } as Token)
            : ({ address: this.config.USDA, decimals: 18 } as Token),
        ],
        // liquidity is infinite as to have been able to mint stUSD, you must have deposited USDA
        liquidityUSD: 1e12,
      },
    ];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}

  _knownAddress(
    srcToken: Token,
    destToken: Token,
  ): { known: boolean; agToken: string | null; stakeToken: string | null } {
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (
      (srcTokenAddress === this.config.EURA &&
        destTokenAddress === this.config.stEUR) ||
      (srcTokenAddress === this.config.stEUR &&
        destTokenAddress === this.config.EURA)
    ) {
      return {
        known: true,
        agToken: this.config.EURA,
        stakeToken: this.config.stEUR,
      };
    }
    if (
      (srcTokenAddress === this.config.USDA &&
        destTokenAddress === this.config.stUSD) ||
      (srcTokenAddress === this.config.stUSD &&
        destTokenAddress === this.config.USDA)
    ) {
      return {
        known: true,
        agToken: this.config.USDA,
        stakeToken: this.config.stUSD,
      };
    }
    return { known: false, agToken: null, stakeToken: null };
  }
}
