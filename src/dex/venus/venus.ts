import { Interface, JsonFragment } from '@ethersproject/abi';
import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  DexExchangeParam,
  NumberAsString,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { VenusData, PoolConfig } from './types';
import { SimpleExchange } from '../simple-exchange';
import { VenusConfig } from './config';
import { VenusPollingPool } from './venus-pool';
import TokenConverterAbi from '../../abi/venus/token-converter.json';
import { assert } from 'ts-essentials';
import { StatePollingManager } from '../../lib/stateful-rpc-poller/state-polling-manager';

export const TOKEN_CONVERTER_CONFIGS_CACHE_KEY = 'token-converter-configs';
export const UNISWAPV3_EFFICIENCY_FACTOR = 3;

export class Venus extends SimpleExchange implements IDex<VenusData> {
  protected pollingManager: StatePollingManager;

  protected pollingPool?: VenusPollingPool;

  readonly hasConstantPriceLargeAmounts = false;

  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  protected _tokenConverter?: PoolConfig;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(VenusConfig);

  logger: Logger;

  tokenConverterInterface: Interface;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected config = VenusConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);

    this.logger = dexHelper.getLogger(dexKey);

    this.pollingManager = StatePollingManager.getInstance(dexHelper);

    this.tokenConverterInterface = new Interface(
      TokenConverterAbi as JsonFragment[],
    );
  }

  get tokenConverter(): PoolConfig {
    if (!this._tokenConverter) {
      throw new Error(
        `TokenConverter are not set for ${this.dexKey}-${this.network}. Not properly initialized`,
      );
    }
    return this._tokenConverter;
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    if (!this._tokenConverter) {
      this._tokenConverter = await this.fetchTokenConverter(
        this.config.converterAddress,
      );
    }
    if (!this.pollingPool) {
      this._initializePollingPool();
    }
  }

  // Legacy: was only used for V5
  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
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
    return [this.dexKey, srcToken.address, destToken.address];
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    _srcToken: Token,
    _destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<VenusData>> {
    const destToken = this.dexHelper.config.wrapETH(_destToken);

    const { value } = (await this.pollingPool?.getState()) || {};
    if (value && value[destToken.address.toLowerCase()]) {
      // && side === SwapSide.SELL
      return [
        {
          prices: amounts.map(
            amount =>
              (BigInt(value[destToken.address.toLowerCase()].amountOut) *
                BigInt(amount)) /
              BigInt(10 ** destToken.decimals),
          ),
          unit: getBigIntPow(destToken.decimals),
          gasCost: 1100000000,
          exchange: this.dexKey,
          data: {
            tokenConverter: this.tokenConverter.address,
          },
          poolAddresses: [this.tokenConverter.address],
        },
      ];
    }
    return null;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<VenusData>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: VenusData,
    side: SwapSide,
  ): DexExchangeParam {
    const { tokenConverter } = data;

    const exchangeData = this.tokenConverterInterface.encodeFunctionData(
      'convertExactTokens',
      [srcAmount, destAmount, srcToken, destToken, recipient],
    );
    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData,
      targetExchange: tokenConverter,
      returnAmountPos: undefined,
    };
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
    data: VenusData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: '0x',
      payload: '0x',
      networkFee: '0',
    };
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    if (!this._tokenConverter) {
      this._tokenConverter = await this.fetchTokenConverter(
        this.config.converterAddress,
      );
    }

    if (this.pollingPool === undefined) {
      this._initializePollingPool();
    }
    assert(
      this.pollingPool,
      'pollingPool is not initialized in updatePoolState',
    );
    await this.pollingPool.getState();

    const state = await this.pollingPool.getState();

    if (!state) {
      throw new Error('State is null');
    }
  }

  private async _querySubgraph<T>(
    query: string,
    variables: Object,
    timeout = 30000,
  ) {
    try {
      const res = await this.dexHelper.httpRequest.querySubgraph<{ data: T }>(
        this.config.subgraphURL,
        { query, variables },
        { timeout },
      );

      return res.data;
    } catch (e) {
      this.logger.error(`${this.dexKey}: can not query subgraph: `, e);
      return {} as Partial<T>;
    }
  }

  private async fetchTokenConverter(
    tokenConverterAddress: Address,
  ): Promise<PoolConfig | undefined> {
    if (this._tokenConverter) {
      return this.tokenConverter;
    }
    const { tokenConverter } = await this._querySubgraph<{
      tokenConverter: PoolConfig;
    }>(
      `
    query ($tokenConverterAddress: Bytes) {
      tokenConverter(id: $tokenConverterAddress) {
        address
        baseAsset {
          address
          decimals
        }
        priceOracleAddress
        configs(
          where: {
            and: [
              { tokenOutBalance_gt: 0 },
              { or: [{ access: ALL }, { access: ONLY_FOR_USERS }] },
              {tokenOut_not: "0x12f31b73d812c6bb0d735a218c086d44d5fe5f89"}
            ]
          }
        ) {
          tokenOutBalance
          tokenIn {
            address
            symbol
            decimals
          }
          tokenOut {
            address
            symbol
            decimals
          }
        }
    }
}`,
      { tokenConverterAddress },
    );
    return tokenConverter;
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    _tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const tokenAddress = _tokenAddress.toLowerCase();
    const { value: latestState } = (await this.pollingPool?.getState()) || {};
    if (!this.tokenConverter) {
      this.logger.error(
        `Error_${this.dexKey}_cache: couldn't fetch token converter`,
      );
      return [];
    }

    if (!latestState) {
      this.logger.error(
        `Error_${this.dexKey}_cache: couldn't fetch latest pool state`,
      );
      return [];
    }

    const pools = this.tokenConverter.configs.reduce((acc, config) => {
      if (
        config.tokenIn.address.toLowerCase() === tokenAddress.toLowerCase() ||
        config.tokenOut.address.toLowerCase() === tokenAddress.toLowerCase()
      ) {
        acc.push({
          exchange: this.dexKey,
          address: this.tokenConverter.address,
          connectorTokens: [
            {
              address: config.tokenOut.address.toLowerCase(),
              decimals: parseInt(config.tokenOut.decimals),
            },
          ],
          liquidityUSD: parseFloat(
            (
              BigInt(config.tokenOutBalance) *
              BigInt(latestState[config.tokenOut.address.toLowerCase()].price)
            ).toString(),
          ),
        });
      }
      return acc;
    }, [] as PoolLiquidity[]);
    return pools
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, limit);
  }

  getIdentifier() {
    return `${this.dexKey}_token_converters`;
  }

  private _initializePollingPool() {
    this.pollingPool = new VenusPollingPool(
      this.dexKey,
      this.getIdentifier(),
      this.dexHelper,
      this.config,
      this.tokenConverter,
    );

    this.pollingManager.initializeAllPendingPools();
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    this.pollingManager.disableStateTracking(this.dexKey);
    this.pollingPool = undefined;
  }
}
