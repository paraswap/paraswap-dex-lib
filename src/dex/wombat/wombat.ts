import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { Interface } from '@ethersproject/abi';

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
import { Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper';
import { DexParams, PoolState, WombatData } from './types';
import {
  getLocalDeadlineAsFriendlyPlaceholder,
  SimpleExchange,
} from '../simple-exchange';
import { Adapters, WombatConfig } from './config';
import { WombatEventPool } from './wombat-pool';
import PoolABI from '../../abi/wombat/pool.json';
import AssetABI from '../../abi/wombat/asset.json';
import BmwABI from '../../abi/wombat/bmw.json';
import ERC20ABI from '../../abi/erc20.json';
import { SwapSide } from '@paraswap/core';
import { WombatQuoter } from './wombat-quoter';
import { WombatBmw } from './wombat-bmw';
import { fromWad } from './utils';

export class Wombat extends SimpleExchange implements IDex<WombatData> {
  // contract interfaces
  static readonly erc20Interface = new Interface(ERC20ABI);
  static readonly poolInterface = new Interface(PoolABI);
  static readonly assetInterface = new Interface(AssetABI);
  static readonly bmwInterface = new Interface(BmwABI);

  protected config: DexParams;
  protected poolLiquidityUSD?: { [poolAddress: string]: number };
  public bmw: WombatBmw;
  public eventPools: { [poolAddress: string]: WombatEventPool } = {};

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: {
    key: string;
    networks: Network[];
  }[] = getDexKeysWithNetwork(WombatConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.config = WombatConfig[dexKey][network];
    this.bmw = new WombatBmw(
      dexKey,
      this.config.bmwAddress,
      network,
      dexHelper,
      this.logger,
      this.config.bmwAddress,
      this.onPoolAdded.bind(this),
    );
  }

  async init(blockNumber: number) {
    await this.bmw.initialize(blockNumber);
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.init(blockNumber);
    const bmwState = this.bmw.getState(blockNumber);
    if (!bmwState) {
      throw new Error('initializePricing: bmwState still null after init');
    }
  }

  onPoolAdded = async (pool: Address, blockNumber: number): Promise<void> => {
    if (!this.eventPools[pool]) {
      this.eventPools[pool] = new WombatEventPool(
        this.dexKey,
        pool,
        this.network,
        this.dexHelper,
        this.logger,
        pool,
      );

      await this.eventPools[pool].initialize(blockNumber);
    }
  };

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
    return (
      await this.findPools(
        srcToken.address.toLowerCase(),
        destToken.address.toLowerCase(),
        blockNumber,
      )
    ).map(p => this.getPoolIdentifier(p));
  }

  protected getPoolIdentifier(poolAddress: Address): string {
    return `${this.dexKey}_${poolAddress}`;
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
  ): Promise<null | ExchangePrices<WombatData>> {
    if (!this.eventPools) {
      this.logger.error(
        `Missing event pools for ${this.dexKey} in getPricesVolume`,
      );
      return null;
    }
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (srcTokenAddress === destTokenAddress) return null;

    const pools = await this.findPools(
      srcTokenAddress,
      destTokenAddress,
      blockNumber,
    );
    return await Promise.all(
      pools
        .filter(
          poolAddress =>
            !limitPools ||
            limitPools.includes(this.getPoolIdentifier(poolAddress)),
        )
        .map(poolAddress =>
          (async () => {
            let state = this.eventPools![poolAddress].getState(blockNumber);
            if (!state) {
              state = await this.eventPools![poolAddress].generateState(
                blockNumber,
              );
              this.eventPools![poolAddress].setState(state, blockNumber);
            }
            const [unit, ...prices] = this.computePrices(
              srcTokenAddress,
              destTokenAddress,
              [getBigIntPow(srcToken.decimals), ...amounts],
              side,
              state,
            );
            return {
              prices,
              unit,
              data: {
                exchange: poolAddress,
              },
              poolAddresses: [poolAddress],
              exchange: this.dexKey,
              /** @todo specify gas cost */
              gasCost: 260 * 1000,
              poolIdentifier: this.getPoolIdentifier(poolAddress),
            };
          })(),
        ),
    );
  }

  // take PoolState to compute price
  protected computePrices(
    srcTokenAddress: Address,
    destTokenAddress: Address,
    amounts: bigint[],
    side: SwapSide,
    state: DeepReadonly<PoolState>,
  ): bigint[] {
    const srcAsset = state.asset[srcTokenAddress];
    const destAsset = state.asset[destTokenAddress];
    const quoter = new WombatQuoter(state.params);

    return amounts.map(fromAmount => {
      return side === SwapSide.SELL
        ? quoter.getQuote(srcAsset, destAsset, fromAmount)
        : quoter.getQuote(destAsset, srcAsset, -fromAmount);
    });
  }

  protected async findPools(
    srcTokenAddress: Address,
    destTokenAddress: Address,
    blockNumber: number,
  ): Promise<Address[]> {
    const pools: Address[] = [];
    for (const [poolAddress, eventPool] of Object.entries(this.eventPools)) {
      let state = eventPool.getState(blockNumber);
      if (!state) {
        state = await eventPool.generateState(blockNumber);
        this.eventPools![poolAddress].setState(state, blockNumber);
      }

      if (
        state &&
        !state.params.paused &&
        state.asset[srcTokenAddress] &&
        state.asset[srcTokenAddress].liability > 0 &&
        state.asset[destTokenAddress] &&
        state.asset[destTokenAddress].liability > 0
      ) {
        pools.push(poolAddress);
      }
    }

    return pools;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<WombatData>): number | number[] {
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
    data: WombatData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '0x';

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
    data: WombatData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { exchange } = data;

    // Encode here the transaction arguments
    const swapData = Wombat.poolInterface.encodeFunctionData('swap', [
      srcToken,
      destToken,
      srcAmount,
      1 /** @todo assume slippage tolorence is 2% and set the minimum receive accordingly */,
      this.augustusAddress,
      getLocalDeadlineAsFriendlyPlaceholder(),
    ]);

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
  // getTopPoolsForToken. For example, poolLiquidityUSD.
  async updatePoolState(): Promise<void> {
    const blockNumber = await this.dexHelper.provider.getBlockNumber();
    await this.init(blockNumber);
    const bmwState = this.bmw.getState(blockNumber);
    if (!bmwState) {
      throw new Error('updatePoolState: bmwState still null after init');
    }

    // All tokens are USD stablecoins so to estimate liquidity can just add
    // the cash balances of all the tokens
    const poolLiquidityUSD: { [poolAddress: string]: number } = {};
    const usdPromises = [];
    const poolStates: { [poolAddress: string]: DeepReadonly<PoolState> } = {};
    for (const [poolAddress, eventPool] of Object.entries(this.eventPools)) {
      let state = eventPool.getState(blockNumber);
      if (!state) {
        state = await eventPool.generateState(blockNumber);
        eventPool.setState(state, blockNumber);
      }
      poolStates[poolAddress] = state;
      for (const [tokenAddress, assetState] of Object.entries(state.asset)) {
        usdPromises.push(
          this.dexHelper.getTokenUSDPrice(
            {
              address: tokenAddress,
              decimals: assetState.underlyingTokenDecimals,
            },
            fromWad(
              assetState.cash,
              BigInt(assetState.underlyingTokenDecimals),
            ),
          ),
        );
      }
    }
    const usdValues = await Promise.all(usdPromises);

    for (const [poolAddress, poolState] of Object.entries(poolStates)) {
      poolLiquidityUSD[poolAddress] = 0;
      for (let i = 0; i < poolState.underlyingAddresses.length; i++) {
        poolLiquidityUSD[poolAddress] += usdValues[i];
      }
    }

    this.poolLiquidityUSD = poolLiquidityUSD;
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.poolLiquidityUSD) await this.updatePoolState();
    const blockNumber = await this.dexHelper.provider.getBlockNumber();
    tokenAddress = tokenAddress.toLowerCase();
    const pools: string[] = [];
    const poolStates: { [poolAddress: string]: DeepReadonly<PoolState> } = {};
    for (const [poolAddress, eventPool] of Object.entries(this.eventPools)) {
      let state = eventPool.getState(blockNumber);
      if (!state) {
        state = await eventPool.generateState(blockNumber);
        eventPool.setState(state, blockNumber);
      }
      if (
        state.underlyingAddresses.includes(tokenAddress) &&
        this.poolLiquidityUSD![poolAddress]
      ) {
        poolStates[poolAddress] = state;
        pools.push(poolAddress);
      }
    }

    // sort by liquidity
    pools.sort((a, b) => this.poolLiquidityUSD![b] - this.poolLiquidityUSD![a]);
    return pools.slice(0, limit).map(poolAddress => ({
      exchange: this.dexKey,
      address: poolAddress,
      // other tokens in the same pool
      connectorTokens: poolStates[poolAddress].underlyingAddresses
        .filter(t => t !== tokenAddress)
        .map(t => ({
          decimals: poolStates[poolAddress].asset[t].underlyingTokenDecimals,
          address: t,
        })),
      liquidityUSD: this.poolLiquidityUSD![poolAddress],
    }));
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
