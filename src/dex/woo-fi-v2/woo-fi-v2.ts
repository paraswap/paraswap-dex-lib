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
import { WooFiV2Data, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { WooFiV2Config, Adapters } from './config';
import { WooFiV2PollingPool } from './woo-fi-v2-pool';
import { StatePollingManager } from '../../lib/stateful-rpc-poller/state-polling-manager';
import { WooFiV2Math } from './woo-fi-v2-math';
import wooPPV2ABI from '../../abi/woo-fi-v2/WooPPV2.abi.json';
import wooOracleV2ABI from '../../abi/woo-fi-v2/WooOracleV2.abi.json';
import { RefInfo } from '../woo-fi/types';
import { MIN_CONVERSION_RATE } from './constants';

export class WooFiV2 extends SimpleExchange implements IDex<WooFiV2Data> {
  readonly math: WooFiV2Math;

  readonly statePollingManager: StatePollingManager;

  protected pollingPool: WooFiV2PollingPool;

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  readonly quoteTokenAddress: Address;

  vaultUSDBalance: number = 0;

  tokenByAddress: Record<Address, Token> = {};

  private _refInfos: Record<Address, RefInfo> = {};

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(WooFiV2Config);

  logger: Logger;

  static readonly ifaces = {
    PPV2: new Interface(wooPPV2ABI),
    oracleV2: new Interface(wooOracleV2ABI),
    chainlink: new Interface([
      'function latestRoundData() view returns (tuple(uint80 roundId, ' +
        'int256 answer, uint256 startedAt, uint256 updatedAt, ' +
        'uint80 answeredInRound))',
    ]),
    erc20BalanceOf: new Interface([
      'function balanceOf(address) view returns (uint256)',
    ]),
  };

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly config = WooFiV2Config[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    const loggerName = `${dexKey}-${network}`;
    this.logger = dexHelper.getLogger(loggerName);

    // Normalise once all config addresses and use across all scenarios
    this.config = this._toLowerForAllConfigAddresses();

    this.statePollingManager = StatePollingManager.getInstance(dexHelper);
    this.pollingPool = new WooFiV2PollingPool(
      dexKey,
      this.getIdentifier(),
      dexHelper,
    );

    this.quoteTokenAddress = this.config.quoteToken.address;

    // Do not do it singleton, because different networks will have different
    // states at the same time
    this.math = new WooFiV2Math(
      dexHelper.getLogger(`${loggerName}_math`),
      this.quoteTokenAddress,
    );

    this.tokenByAddress = Object.values(this.baseTokens).reduce(
      (acc, cur) => {
        acc[cur.address] = cur;
        return acc;
      },
      { [this.quoteTokenAddress]: this.config.quoteToken },
    );
  }

  private _toLowerForAllConfigAddresses() {
    // If new config property will be added, the TS will throw compile error
    const newConfig: DexParams = {
      wooPPV2Address: this.config.wooPPV2Address.toLowerCase(),
      wooOracleV2Address: this.config.wooOracleV2Address.toLowerCase(),
      rebateTo: this.config.rebateTo.toLowerCase(),
      quoteToken: {
        ...this.config.quoteToken,
        address: this.config.quoteToken.address.toLowerCase(),
      },
      baseTokens: Object.keys(this.config.baseTokens).reduce<
        Record<string, Token>
      >((acc, cur) => {
        const token = this.config.baseTokens[cur];
        token.address = token.address.toLowerCase();
        acc[cur] = token;
        return acc;
      }, {}),
    };
    return newConfig;
  }

  get baseTokens(): Token[] {
    return Object.values(this.config.baseTokens);
  }

  async initializePricing(blockNumber: number) {
    // await this.getState(blockNumber);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (side === SwapSide.BUY) return [];

    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    const _srcAddress = _srcToken.address.toLowerCase();
    const _destAddress = _destToken.address.toLowerCase();

    if (_srcAddress === _destAddress) return [];

    if (
      !this.tokenByAddress[_srcAddress] ||
      !this.tokenByAddress[_destAddress]
    ) {
      return [];
    }

    const { isSrcQuote, isDestQuote } = this._identifyQuote(
      _srcAddress,
      _destAddress,
    );

    if (!isSrcQuote && !isDestQuote) return [];

    return [this.getIdentifier()];
  }

  getIdentifier() {
    return `${this.dexKey}_wooppv2`;
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<WooFiV2Data>> {
    // TODO: complete me!
    return null;
  }

  getCalldataGasCost(poolPrices: PoolPrices<WooFiV2Data>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: WooFiV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const payload = this.abiCoder.encodeParameter(
      'address',
      this.config.rebateTo,
    );

    return {
      targetExchange: this.config.wooPPV2Address,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: WooFiV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const _srcToken = srcToken.toLowerCase();
    const _destToken = destToken.toLowerCase();

    let funcName: string;
    let _amount: string;
    let baseToken: string;
    if (_srcToken === this.quoteTokenAddress) {
      baseToken = _destToken;
      funcName = 'sellQuote';
      _amount = srcAmount;
    } else if (_destToken === this.quoteTokenAddress) {
      baseToken = _srcToken;
      funcName = 'sellBase';
      _amount = srcAmount;
    } else {
      throw new Error(
        `srcToken ${srcToken} or destToken ${destToken} must be quoteToken`,
      );
    }

    const swapData = WooFiV2.ifaces.PPV2.encodeFunctionData(funcName, [
      baseToken, // baseToken
      _amount, // amount
      MIN_CONVERSION_RATE, // minAmount
      this.augustusAddress, // to
      this.config.rebateTo, // rebateTo
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.config.wooPPV2Address,
    );
  }

  async updatePoolState(): Promise<void> {
    const state = await this.pollingPool.getState();

    if (!state) {
      this.logger.error(
        `Failed to updatePoolState. State is null. VaultUSDBalance: ${this.vaultUSDBalance} was not updated`,
      );
      return;
    }

    const tokenBalancesUSD = await Promise.all(
      Object.values(this.tokenByAddress).map(t =>
        this.dexHelper.getTokenUSDPrice(
          t,
          state.value.tokenInfos[t.address].reserve,
        ),
      ),
    );
    this.vaultUSDBalance = tokenBalancesUSD.reduce(
      (sum: number, curr: number) => sum + curr,
    );
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const wrappedTokenAddress = this.dexHelper.config
      .wrapETH({ address: tokenAddress, decimals: 0 })
      .address.toLowerCase();

    if (!this.tokenByAddress[wrappedTokenAddress]) return [];

    const latestState = await this.pollingPool.getState();
    if (!latestState) return [];

    if (latestState.value.isPaused) {
      this.logger.warn(`Paused on ${this.network} in getTopPoolsForToken`);
      return [];
    }

    const connectorTokens =
      wrappedTokenAddress === this.quoteTokenAddress
        ? this.baseTokens
        : [this.tokenByAddress[this.quoteTokenAddress]];

    return [
      {
        exchange: this.dexKey,
        address: this.config.wooPPV2Address,
        connectorTokens,
        liquidityUSD: this.vaultUSDBalance,
      },
    ];
  }

  private _identifyQuote(srcAddress: Address, destAddress: Address) {
    return {
      isSrcQuote: srcAddress === this.quoteTokenAddress,
      isDestQuote: destAddress === this.quoteTokenAddress,
    };
  }
}
