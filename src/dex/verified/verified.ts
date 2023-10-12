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
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  PoolState,
  PoolStateCache,
  PoolStateMap,
  SubgraphPoolBase,
  VerifiedData,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { VerifiedConfig, Adapters } from './config';
import { VerifiedEventPool } from './verified-pool';
import {
  BalancerV2Data,
  BalancerV2DirectParam,
  OptimizedBalancerV2Data,
} from '../balancer-v2/types';
import VAULTABI from '../../abi/verified/vault.json';
import { BalancerConfig } from '../balancer-v2/config';
import {
  getAllPoolsUsedInPaths,
  poolAddressMap,
  poolGetPathForTokenInOut,
} from './utils';
import { STABLE_GAS_COST, VARIABLE_GAS_COST_PER_CYCLE } from './constants';

export class Verified extends SimpleExchange implements IDex<VerifiedData> {
  protected eventPools: VerifiedEventPool;
  readonly hasConstantPriceLargeAmounts = false;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BalancerConfig);

  logger: Logger;
  // In memory pool state for non-event pools
  nonEventPoolStateCache: PoolStateCache;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    public vaultAddress: Address = VerifiedConfig[dexKey][network].vaultAddress,
    protected subgraphURL: string = VerifiedConfig[dexKey][network].subGraphUrl,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.eventPools = new VerifiedEventPool(
      dexKey,
      network,
      dexHelper,
      vaultAddress,
      subgraphURL,
      this.logger,
    );
    //init non-event pool cache
    this.nonEventPoolStateCache = { blockNumber: 0, poolState: {} };
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.eventPools.initialize(blockNumber);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPoolsWithTokenPair(from: Token, to: Token): SubgraphPoolBase[] {
    const pools = this.eventPools.allPools.filter(p => {
      const fromMain = p.mainTokens.find(
        token => token.address.toLowerCase() === from.address.toLowerCase(),
      );
      const toMain = p.mainTokens.find(
        token => token.address.toLowerCase() === to.address.toLowerCase(),
      );

      return (
        fromMain &&
        toMain &&
        // filter instances similar to the following:
        // USDC -> DAI in a pool where bbaUSD is nested (ie: MAI / bbaUSD)
        !(fromMain.isDeeplyNested && toMain.isDeeplyNested)
      );
    });

    return pools.slice(0, 10);
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token, //Token From
    destToken: Token, //Token To
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const from = this.dexHelper.config.wrapETH(srcToken);
    const to = this.dexHelper.config.wrapETH(destToken);

    const pools = this.getPoolsWithTokenPair(from, to);

    return pools.map(
      ({ address }) => `${this.dexKey}_${address.toLowerCase()}`,
    );
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token, //From Token
    destToken: Token, //Token To
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<VerifiedData>> {
    try {
      const from = this.dexHelper.config.wrapETH(srcToken);
      const to = this.dexHelper.config.wrapETH(destToken);

      if (from.address === to.address) {
        return null;
      }

      const allPools = this.getPoolsWithTokenPair(from, to);
      const allowedPools = limitPools
        ? allPools.filter(({ address }) =>
            limitPools.includes(`${this.dexKey}_${address.toLowerCase()}`),
          )
        : allPools;

      if (!allowedPools.length) return null;

      const eventPoolStatesRO = this.eventPools.getState(blockNumber);
      if (!eventPoolStatesRO) {
        this.logger.error(`getState returned null`);
      }
      const eventPoolStates = { ...(eventPoolStatesRO || {}) };
      // Fetch previously cached non-event pool states
      let nonEventPoolStates = this.getNonEventPoolStateCache(blockNumber);

      //get all pools that would be used in the paths, nested pools included
      const poolsFlattened = getAllPoolsUsedInPaths(
        from.address,
        to.address,
        allowedPools,
        poolAddressMap(this.eventPools.allPools),
        side,
      );

      // Missing pools are pools that don't already exist in event or non-event
      const missingPools = poolsFlattened.filter(
        (pool: { address: string }) =>
          !(
            pool.address.toLowerCase() in eventPoolStates ||
            pool.address.toLowerCase() in nonEventPoolStates
          ),
      );

      // Retrieve onchain state for any missing pools
      if (missingPools.length > 0) {
        const missingPoolsStateMap = await this.eventPools.getOnChainState(
          missingPools,
          blockNumber,
        );
        // Update non-event pool state cache with newly retrieved data so it can be reused in future
        nonEventPoolStates = this.updateNonEventPoolStateCache(
          missingPoolsStateMap,
          blockNumber,
        );
      }

      const poolPrices = allowedPools
        .map((pool: SubgraphPoolBase) => {
          const poolAddress = pool.address.toLowerCase();

          const path = poolGetPathForTokenInOut(
            from.address,
            to.address,
            pool,
            poolAddressMap(this.eventPools.allPools),
            side,
          );

          let pathAmounts = amounts;
          let resOut: { unit: bigint; prices: bigint[] } | null = null;

          for (let i = 0; i < path.length; i++) {
            const poolAddress = path[i].pool.address.toLowerCase();
            const poolState = (eventPoolStates[poolAddress] ||
              nonEventPoolStates[poolAddress]) as PoolState | undefined;
            if (!poolState) {
              this.logger.error(`Unable to find the poolState ${poolAddress}`);
              return null;
            }

            const unitVolume = getBigIntPow(
              (side === SwapSide.SELL ? path[i].tokenIn : path[i].tokenOut)
                .decimals,
            );
            const creator = '';
            const res = this.eventPools.getPricesPool(
              path[i].tokenIn,
              path[i].tokenOut,
              path[i].pool,
              poolState,
              pathAmounts,
              unitVolume,
              side,
              creator,
            );

            if (!res) {
              return null;
            }

            pathAmounts = res.prices;

            if (i === path.length - 1) {
              resOut = res;
            }
          }

          if (!resOut) {
            return null;
          }

          return {
            unit: resOut.unit,
            prices: resOut.prices,
            data: {
              poolId: pool.id,
            },
            poolAddresses: [poolAddress],
            exchange: this.dexKey,
            gasCost:
              STABLE_GAS_COST + VARIABLE_GAS_COST_PER_CYCLE * path.length,
            poolIdentifier: `${this.dexKey}_${poolAddress}`,
          };

          // TODO: re-check what should be the current block time stamp
        })
        .filter(p => !!p);
      return poolPrices as ExchangePrices<VerifiedData>;
    } catch (e) {
      this.logger.error(
        `Error_getPrices ${srcToken.symbol || srcToken.address}, ${
          destToken.symbol || destToken.address
        }, ${side}:`,
        e,
      );
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<VerifiedData>): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_LARGE +
      // ParentStruct header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[] header
      CALLDATA_GAS_COST.OFFSET_LARGE +
      // ParentStruct -> assets[] header
      CALLDATA_GAS_COST.OFFSET_LARGE +
      // ParentStruct -> funds
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.BOOL +
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.BOOL +
      // ParentStruct -> limits[] header
      CALLDATA_GAS_COST.OFFSET_LARGE +
      // ParentStruct -> deadline
      CALLDATA_GAS_COST.TIMESTAMP +
      // ParentStruct -> swaps[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> swaps[0] header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[0] -> poolId
      CALLDATA_GAS_COST.FULL_WORD +
      // ParentStruct -> swaps[0] -> assetInIndex
      CALLDATA_GAS_COST.INDEX +
      // ParentStruct -> swaps[0] -> assetOutIndex
      CALLDATA_GAS_COST.INDEX +
      // ParentStruct -> swaps[0] -> amount
      CALLDATA_GAS_COST.AMOUNT +
      // ParentStruct -> swaps[0] -> userData header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[0] -> userData
      CALLDATA_GAS_COST.ZERO +
      // ParentStruct -> assets[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> assets[0:2]
      CALLDATA_GAS_COST.ADDRESS * 2 +
      // ParentStruct -> limits[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> limits[0:2]
      CALLDATA_GAS_COST.FULL_WORD * 2
    );
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: VerifiedData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    const { poolId } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: poolId,
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
    data: VerifiedData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    // TODO: complete me!
    const { poolId } = data;

    // Encode here the transaction arguments
    const swapData = '';

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      poolId,
    );
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
    //TODO: complete me!
    return [];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }

  /**
   * Returns cached poolState if blockNumber matches cached value. Resets if not.
   */
  private getNonEventPoolStateCache(blockNumber: number): PoolStateMap {
    if (this.nonEventPoolStateCache.blockNumber !== blockNumber)
      this.nonEventPoolStateCache.poolState = {};
    return this.nonEventPoolStateCache.poolState;
  }

  /**
   * Update poolState cache.
   * If same blockNumber as current cache then update with new pool state.
   * If different blockNumber overwrite cache with latest.
   */
  private updateNonEventPoolStateCache(
    poolState: PoolStateMap,
    blockNumber: number,
  ): PoolStateMap {
    if (this.nonEventPoolStateCache.blockNumber !== blockNumber) {
      this.nonEventPoolStateCache.blockNumber = blockNumber;
      this.nonEventPoolStateCache.poolState = poolState;
    } else
      this.nonEventPoolStateCache.poolState = {
        ...this.nonEventPoolStateCache.poolState,
        ...poolState,
      };
    return this.nonEventPoolStateCache.poolState;
  }
}
