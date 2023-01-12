import { AsyncOrSync } from 'ts-essentials';
import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';

import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  MultiCallInput,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { WombatData, DexParams, WombatConfigInfo, PoolState } from './types';
import { SimpleExchange } from '../simple-exchange';
import { WombatConfig, Adapters } from './config';
import { WombatEventPool } from './wombat-pool';
import { quoteFrom } from './utils';
import PoolABI from '../../abi/wombat/pool.json';
import AssetABI from '../../abi/wombat/asset.json';
import ERC20ABI from '../../abi/erc20.json';

export class Wombat extends SimpleExchange implements IDex<WombatData> {
  // contract interfaces
  static readonly erc20Interface = new Interface(ERC20ABI);
  static readonly poolInterface = new Interface(PoolABI);
  static readonly assetInterface = new Interface(AssetABI);

  protected config: DexParams;
  protected cfgInfo?: WombatConfigInfo;
  protected poolLiquidityUSD?: { [poolAddress: string]: number };

  protected eventPools?: { [poolAddress: string]: WombatEventPool };

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(WombatConfig);

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
  }

  async generateConfigInfo(blockNumber: number): Promise<WombatConfigInfo> {
    const cfgInfo: WombatConfigInfo = {
      poolAddresses: [],
      pools: {},
    };
    // Need to filter pools in case we are testing against an old block where the pool didn't exist!
    for (const p of this.config.pools) {
      // When there's no code, getCode should return '0x' but could return '0x0' instead
      if (
        (await this.dexHelper.web3Provider.eth.getCode(p.address, blockNumber))
          .length > 3 // it's not '0x' or '0x0'
      ) {
        cfgInfo.poolAddresses.push(p.address.toLowerCase());
      }
    }
    // 1. Get tokens in each pool
    let inputs: MultiCallInput[] = [];
    for (const poolAddress of cfgInfo.poolAddresses) {
      inputs.push({
        target: poolAddress,
        callData: Wombat.poolInterface.encodeFunctionData('getTokens'),
      });
    }
    let returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(inputs)
        .call({}, blockNumber)
    ).returnData;

    let i = 0;
    for (const poolAddress of cfgInfo.poolAddresses) {
      const tokenAddresses = Wombat.poolInterface
        .decodeFunctionResult('getTokens', returnData[i++])[0]
        .toLowerCase();
      cfgInfo.pools[poolAddress] = {
        tokenAddresses,
        tokens: {},
      };
    }

    // 2. For each pool, get tokens' symbol, decimals, asset (LP token) address
    inputs = [];
    for (const poolAddress of cfgInfo.poolAddresses) {
      for (const tokenAddress of cfgInfo.pools[poolAddress].tokenAddresses) {
        inputs.push({
          target: tokenAddress,
          callData: Wombat.erc20Interface.encodeFunctionData('symbol'),
        });
        inputs.push({
          target: tokenAddress,
          callData: Wombat.erc20Interface.encodeFunctionData('decimals'),
        });
        inputs.push({
          target: poolAddress,
          callData: Wombat.poolInterface.encodeFunctionData('addressOfAsset', [
            tokenAddress,
          ]),
        });
      }
    }
    returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(inputs)
        .call({}, blockNumber)
    ).returnData;
    i = 0;
    for (const poolAddress of cfgInfo.poolAddresses) {
      for (const tokenAddress of cfgInfo.pools[poolAddress].tokenAddresses) {
        const tokenSymbol = Wombat.erc20Interface.decodeFunctionResult(
          'symbol',
          returnData[i++],
        )[0];
        const tokenDecimals = Wombat.erc20Interface.decodeFunctionResult(
          'decimals',
          returnData[i++],
        )[0];
        const assetAddress = Wombat.poolInterface
          .decodeFunctionResult('addressOfAsset', returnData[i++])[0]
          .toLowerCase();
        cfgInfo.pools[poolAddress].tokens[tokenAddress] = {
          tokenSymbol,
          tokenDecimals,
          assetAddress,
        };
      }
    }
    return cfgInfo;
  }

  async init(blockNumber: number) {
    if (this.cfgInfo) return;
    this.cfgInfo = await this.generateConfigInfo(blockNumber);
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.init(blockNumber);
    if (!this.cfgInfo)
      throw new Error('initializePricing: cfgInfo still null after init');

    const eventPools: { [poolAddress: string]: WombatEventPool } = {};
    for (const poolAddress of this.cfgInfo.poolAddresses) {
      const pool = new WombatEventPool(
        this.dexKey,
        '' /** @todo pool name */,
        // this.config.pools.find(
        //   p => p.address.toLowerCase() === poolAddress,
        // )!.name,
        3 /** @todo network number */,
        this.dexHelper,
        this.logger,
        poolAddress,
        this.cfgInfo.pools[poolAddress],
      );
      const state = await pool.generateState(blockNumber);
      pool.setState(state, blockNumber);
      this.dexHelper.blockManager.subscribeToLogs(
        pool,
        pool.addressesSubscribed,
        blockNumber,
      );
      eventPools[poolAddress] = pool;
    }
    this.eventPools = eventPools;
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
    /** @todo implement logic for BUY side */
    if (side === SwapSide.BUY) return [];
    return this.findPools(
      srcToken.address.toLowerCase(),
      destToken.address.toLowerCase(),
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
    /** @todo implement logic for BUY side */
    if (side === SwapSide.BUY) return null;
    if (!this.eventPools) {
      this.logger.error(
        `Missing event pools for ${this.dexKey} in getPricesVolume`,
      );
      return null;
    }
    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();
    if (srcTokenAddress === destTokenAddress) return null;
    return await Promise.all(
      this.findPools(srcTokenAddress, destTokenAddress)
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
              this.cfgInfo!.pools[poolAddress].tokens[srcTokenAddress]
                .tokenDecimals,
              destTokenAddress,
              this.cfgInfo!.pools[poolAddress].tokens[destTokenAddress]
                .tokenDecimals,
              [getBigIntPow(srcToken.decimals), ...amounts],
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
    srcTokenDecimals: number,
    destTokenAddress: Address,
    destTokenDecimals: number,
    amounts: bigint[],
    state: DeepReadonly<PoolState>,
  ): bigint[] {
    return amounts.map(fromAmount => {
      return quoteFrom(
        state.asset[srcTokenAddress].cash,
        state.asset[srcTokenAddress].cash,
        state.asset[destTokenAddress].liability,
        state.asset[destTokenAddress].liability,
        fromAmount,
        state.params.ampFactor,
        state.params.haircutRate,
      );
    });
  }

  protected findPools(
    srcTokenAddress: Address,
    destTokenAddress: Address,
  ): Address[] {
    if (!this.cfgInfo) return [];
    return Object.entries(this.cfgInfo.pools)
      .filter(
        ([poolAddress, poolConfig]) =>
          poolConfig.tokenAddresses.includes(srcTokenAddress) &&
          poolConfig.tokenAddresses.includes(destTokenAddress),
      )
      .map(([poolAddress, poolConfig]) => poolAddress);
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
      this.getDeadline(),
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
    if (!this.cfgInfo)
      throw new Error('updatePoolState: Wombat cfgInfo still null after init');

    // All tokens are USD stablecoins so to estimate liquidity can just add
    // the cash balances of all the tokens
    const poolLiquidityUSD: { [poolAddress: string]: number } = {};
    let inputs: MultiCallInput[] = [];
    for (const poolAddress of this.cfgInfo.poolAddresses) {
      for (const tokenAddress of this.cfgInfo.pools[poolAddress]
        .tokenAddresses) {
        inputs.push({
          target:
            this.cfgInfo.pools[poolAddress].tokens[tokenAddress].assetAddress,
          callData: Wombat.assetInterface.encodeFunctionData('cash'),
        });
      }
    }
    const returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(inputs)
        .call({}, blockNumber)
    ).returnData;
    const usdPromises = [];
    let i = 0;
    for (const poolAddress of this.cfgInfo.poolAddresses) {
      for (const tokenAddress of this.cfgInfo.pools[poolAddress]
        .tokenAddresses) {
        usdPromises.push(
          this.dexHelper.getTokenUSDPrice(
            {
              address: tokenAddress,
              decimals:
                this.cfgInfo.pools[poolAddress].tokens[tokenAddress]
                  .tokenDecimals,
            },
            /** @todo wombat asset addresses always have 18 d.p. need to convert this amount to underlying tokens native d.p. */
            BigInt(
              Wombat.assetInterface
                .decodeFunctionResult('cash', returnData[i++])[0]
                .toString(),
            ),
          ),
        );
      }
    }
    const usdValues = await Promise.all(usdPromises);
    i = 0;
    for (const poolAddress of this.cfgInfo.poolAddresses) {
      poolLiquidityUSD[poolAddress] = 0;
      for (const tokenAddress of this.cfgInfo.pools[poolAddress]
        .tokenAddresses) {
        poolLiquidityUSD[poolAddress] += usdValues[i++];
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
    if (!this.cfgInfo || !this.poolLiquidityUSD) await this.updatePoolState();
    tokenAddress = tokenAddress.toLowerCase();
    const pools = this.cfgInfo!.poolAddresses.filter(
      poolAddress => !!this.cfgInfo!.pools[poolAddress].tokens[tokenAddress],
    );
    // sort by liquidity
    pools.sort((a, b) => this.poolLiquidityUSD![b] - this.poolLiquidityUSD![a]);
    return pools.slice(0, limit).map(poolAddress => ({
      exchange: this.dexKey,
      address: poolAddress,
      // other tokens in the same pool
      connectorTokens: this.cfgInfo!.pools[poolAddress].tokenAddresses.filter(
        t => t !== tokenAddress,
      ).map(t => ({
        decimals: this.cfgInfo!.pools[poolAddress].tokens[t].tokenDecimals,
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
