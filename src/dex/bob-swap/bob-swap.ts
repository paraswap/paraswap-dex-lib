import { AsyncOrSync } from 'ts-essentials';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  Logger,
  PoolLiquidity,
  PoolPrices,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { Network, SwapSide } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { BobSwapData, CollateralInfo, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { Adapters, BobSwapConfig } from './config';
import { BobSwapEventPool } from './bob-swap-pool';
import { Interface } from '@ethersproject/abi';
import BobVaultABI from '../../abi/bob-swap/BobVault.json';
import { ERC20EventSubscriber } from '../../lib/generics-events-subscribers/erc20-event-subscriber';
import { BobSwapMath } from './bob-swap-math';
import { assert } from 'ts-essentials';
import { BOB_VAULT_GAS_COST } from './constants';
import { DexParams } from './types';

export class BobSwap extends SimpleExchange implements IDex<BobSwapData> {
  static readonly bobSwapIface = new Interface(BobVaultABI);

  readonly math: BobSwapMath;

  protected eventPools: BobSwapEventPool;

  protected bobTokenTracker: ERC20EventSubscriber;

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  readonly bobSwap: Address;

  readonly bobToken: Address;
  tokenDecimals: Record<Address, number> = {};

  totalUSDBalance: number = 0;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BobSwapConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
    readonly config = BobSwapConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    // protected bobSwapAddress: Address,
    //     protected bobTokenAddress: Address,
    //     protected tokensAddresses: Array<Token>,
    // Normalise once all config addresses and use across all scenarios
    this.config = this._toLowerForAllConfigAddresses();

    this.bobSwap = this.config.bobSwapAddress.toLowerCase();
    this.bobToken = this.config.bobTokenAddress.toLowerCase();
    const loggerName = `${dexKey}-${network}`;
    this.logger = dexHelper.getLogger(loggerName);
    this.bobTokenTracker = new ERC20EventSubscriber(dexHelper, this.bobToken);
    this.math = new BobSwapMath(
      dexHelper.getLogger(`${loggerName}_math`),
      this.bobToken,
    );

    this.config.tokens.forEach(token => {
      this.tokenDecimals[token.address] = token.decimals;
    });

    this.eventPools = new BobSwapEventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
      this.bobSwap,
      this.bobToken,
      this.config.tokens,
      this.erc20Interface,
    );
  }

  private _toLowerForAllConfigAddresses() {
    // If new config property will be added, the TS will throw compile error
    const newConfig: DexParams = {
      bobSwapAddress: this.config.bobSwapAddress.toLowerCase(),
      bobTokenAddress: this.config.bobTokenAddress.toLowerCase(),
      tokens: this.config.tokens.map(token => {
        return {
          ...token,
          address: token.address.toLowerCase(),
        };
      }),
    };
    return newConfig;
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.bobTokenTracker.subscribeToWalletBalanceChange(
      this.bobSwap,
      blockNumber,
    );
    await this.eventPools.fetchAndUpdateState(blockNumber);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  private _isBob(token: string): boolean {
    return this.bobToken.toLowerCase() === token.toLowerCase();
  }

  private _isCollateral(token: string, state: PoolState): boolean {
    return token in state.collaterals;
  }

  private _isBobOrCollateral(token: string, state: PoolState): boolean {
    return this._isBob(token) || this._isCollateral(token, state);
  }

  private async _fetchDecimals(token: string): Promise<number> {
    if (token in this.tokenDecimals) {
      return this.tokenDecimals[token];
    }

    const decimalsData = this.erc20Interface.encodeFunctionData('decimals', []);
    const decimalsRaw = await this.dexHelper.web3Provider.eth.call({
      to: token,
      data: decimalsData,
    });
    const decimalsResult = this.erc20Interface.decodeFunctionResult(
      'decimals',
      decimalsRaw,
    );

    const decimals = Number(decimalsResult.toString());

    this.tokenDecimals[token] = decimals;

    return decimals;
  }

  private _updateDecimals(token: Token) {
    this.tokenDecimals[token.address] = token.decimals;
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
    this._updateDecimals(srcToken);
    this._updateDecimals(destToken);
    if (side === SwapSide.BUY) return [];
    await this.eventPools.fetchAndUpdateState(blockNumber);
    let state = this.eventPools.getState(blockNumber);
    if (state === null) {
      this.logger.error('State is null after check');
      return [];
    }
    if (
      !this._isBobOrCollateral(srcToken.address, state) ||
      !this._isBobOrCollateral(destToken.address, state)
    ) {
      return [];
    }
    return [this.getIdentifier()];
  }

  getIdentifier() {
    return `${this.dexKey}_bobswap`;
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
  ): Promise<null | ExchangePrices<BobSwapData>> {
    this._updateDecimals(srcToken);
    this._updateDecimals(destToken);
    if (side === SwapSide.BUY) return null;
    try {
      await this.eventPools.fetchAndUpdateState(blockNumber);
      let state = this.eventPools.getState(blockNumber);

      if (state === null) {
        this.logger.error('State is null after check');
        return null;
      }

      const checkIsPossibleSwap =
        this._isBobOrCollateral(srcToken.address, state) &&
        this._isBobOrCollateral(destToken.address, state);

      if (!checkIsPossibleSwap || srcToken.address === destToken.address)
        return null;

      const unitVolume = getBigIntPow(srcToken.decimals);

      const _amounts = [unitVolume, ...amounts];

      assert(
        this.eventPools,
        'eventPool is not initialized in getPricesVolume',
      );

      this.math.state = state;

      let prices = this.math.getAmountOut(
        srcToken.address,
        destToken.address,
        _amounts,
        await this.bobTokenTracker.getBalance(this.bobSwap, blockNumber),
      );

      if (!prices) {
        return null;
      }

      const unit = prices[0];

      let gasCost = BOB_VAULT_GAS_COST.swap;

      if (srcToken.address === this.bobToken) {
        gasCost = BOB_VAULT_GAS_COST.sell;
      } else if (destToken.address === this.bobToken) {
        gasCost = BOB_VAULT_GAS_COST.buy;
      }

      return [
        {
          unit,
          prices: prices.slice(1),
          data: {},
          poolIdentifier: this.getIdentifier(),
          exchange: this.dexKey,
          gasCost,
          poolAddresses: [this.bobSwap],
        },
      ];
    } catch (e) {
      this.logger.error(
        `Error_getPricesVolume ${srcToken.symbol || srcToken.address}, ${
          destToken.symbol || destToken.address
        }, ${side}:`,
        e,
      );
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<BobSwapData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
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
    data: BobSwapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy is not supported`);

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: this.bobSwap,
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
    data: BobSwapData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy is not supported`);

    let swapData = BobSwap.bobSwapIface.encodeFunctionData('swap', [
      srcToken,
      destToken,
      srcAmount,
    ]);
    if (this._isBob(srcToken)) {
      swapData = BobSwap.bobSwapIface.encodeFunctionData('sell', [
        destToken,
        srcAmount,
      ]);
    } else if (this._isBob(destToken)) {
      swapData = BobSwap.bobSwapIface.encodeFunctionData('buy', [
        srcToken,
        srcAmount,
      ]);
    }
    // Encode here the transaction arguments

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.bobSwap,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    let state = this.eventPools.getStaleState();

    if (state === null) {
      let blockNumber = await this.dexHelper.provider.getBlockNumber();
      await this.initializePricing(blockNumber);
      state = this.eventPools.getStaleState();
      if (state === null) {
        this.logger.error('State is null after check');
        return;
      }
    }

    const bobBalance = await this.dexHelper.getTokenUSDPrice(
      { address: this.bobToken, decimals: 18 },
      await this.bobTokenTracker.getBalance(
        this.bobSwap,
        this.bobTokenTracker.getStateBlockNumber(),
      ),
    );

    const tokenBalancesUSD = await Promise.all(
      Object.entries(state.collaterals).map(async ([tokenAddress, tokenInfo]) =>
        this.dexHelper.getTokenUSDPrice(
          {
            address: tokenAddress,
            decimals: await this._fetchDecimals(tokenAddress),
          },
          tokenInfo.balance,
        ),
      ),
    );
    this.totalUSDBalance =
      bobBalance +
      tokenBalancesUSD.reduce((sum: number, curr: number) => sum + curr);
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    await this.eventPools.fetchAndUpdateState();
    let state = this.eventPools.getStaleState();

    if (state === null) {
      this.logger.error('State is null after check');
      return [];
    }

    if (!this._isBobOrCollateral(tokenAddress, state)) {
      return [];
    }

    const connectorTokens = await Promise.all(
      Object.entries(state.collaterals).map(
        async ([tokenAddress, tokenInfo]) => {
          return {
            address: tokenAddress,
            decimals: await this._fetchDecimals(tokenAddress),
          };
        },
      ),
    );
    return [
      {
        exchange: this.dexKey,
        address: this.bobSwap,
        connectorTokens,
        liquidityUSD: this.totalUSDBalance,
      },
    ];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}
}
