import { AsyncOrSync, assert } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  PreprocessTransactionOptions,
  ExchangeTxInfo,
  TxInfo,
} from '../../types';
import {
  SwapSide,
  Network,
  ETHER_ADDRESS,
  NULL_ADDRESS,
  MAX_INT,
  MAX_UINT,
  SUBGRAPH_TIMEOUT,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import DirectSwapABI from '../../abi/DirectSwap.json';
import {
  OptimizedVerifiedData,
  PoolState,
  PoolStateCache,
  PoolStateMap,
  SubgraphPoolBase,
  SwapTypes,
  VerifiedData,
  VerifiedDirectParam,
  VerifiedParam,
  VerifiedSwap,
} from './types';
import {
  SimpleExchange,
  getLocalDeadlineAsFriendlyPlaceholder,
} from '../simple-exchange';
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
  isSameAddress,
  mapPoolsBy,
  poolGetPathForTokenInOut,
  uuidToBytes16,
} from './utils';
import { NumberAsString, OptimalSwapExchange } from '@paraswap/core';
import {
  DirectMethods,
  MIN_USD_LIQUIDITY_TO_FETCH,
  STABLE_GAS_COST,
  VARIABLE_GAS_COST_PER_CYCLE,
} from './constants';
import { Interface } from 'ethers/lib/utils';
import _ from 'lodash';

export class Verified
  extends SimpleExchange
  implements IDex<VerifiedData, VerifiedDirectParam, OptimizedVerifiedData>
{
  public eventPools: VerifiedEventPool;
  readonly hasConstantPriceLargeAmounts = false;
  readonly isFeeOnTransferSupported = false;
  readonly directSwapIface = new Interface(DirectSwapABI);

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BalancerConfig);

  logger: Logger;
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
    this.nonEventPoolStateCache = { blockNumber: 0, poolState: {} };
  }
  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. set states for event pools
  async initializePricing(blockNumber: number) {
    await this.eventPools.initialize(blockNumber);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  //gets first 10 pools with from and to tokens as their maintokens
  getPoolsWithTokenPair(from: Token, to: Token): SubgraphPoolBase[] {
    const pools = this.eventPools.allPools.filter(p => {
      return (
        p.mainTokens.find(
          token => token.address.toLowerCase() === from.address.toLowerCase(),
        ) &&
        p.mainTokens.find(
          token => token.address.toLowerCase() === to.address.toLowerCase(),
        )
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
      //Todo: Save a state for poolsMap from generateState in event pools to be reused here
      //get all pools that would be used in the paths
      const poolsFlattened = getAllPoolsUsedInPaths(
        from.address,
        to.address,
        allowedPools,
        mapPoolsBy(this.eventPools.allPools, 'address'),
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
            mapPoolsBy(this.eventPools.allPools, 'address'),
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

  //construct parameters needed for swap on verified
  public getVerifiedParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedVerifiedData,
    side: SwapSide,
  ): VerifiedParam {
    let swapOffset = 0;
    let swaps: VerifiedSwap[] = [];
    let assets: string[] = [];
    let limits: string[] = [];

    for (const swapData of data.swaps) {
      const pool = mapPoolsBy(this.eventPools.allPools, 'id')[swapData.poolId];
      const hasEth = [srcToken.toLowerCase(), destToken.toLowerCase()].includes(
        ETHER_ADDRESS.toLowerCase(),
      );
      const _srcToken = this.dexHelper.config.wrapETH({
        address: srcToken,
        decimals: 18,
      }).address;
      const _destToken = this.dexHelper.config.wrapETH({
        address: destToken,
        decimals: 18,
      }).address;

      let path = poolGetPathForTokenInOut(
        _srcToken,
        _destToken,
        pool,
        mapPoolsBy(this.eventPools.allPools, 'address'),
        side,
      );

      if (side === SwapSide.BUY) {
        path = path.reverse();
      }

      const _swaps = path.map((hop, index) => ({
        poolId: hop.pool.id,
        assetInIndex: swapOffset + index,
        assetOutIndex: swapOffset + index + 1,
        amount:
          (side === SwapSide.SELL && index === 0) ||
          (side === SwapSide.BUY && index === path.length - 1)
            ? swapData.amount
            : '0',
        userData: '0x',
      }));

      swapOffset += path.length + 1;

      // BalancerV2 Uses Address(0) as ETH
      const _assets = [_srcToken, ...path.map(hop => hop.tokenOut.address)].map(
        t => (hasEth && this.dexHelper.config.isWETH(t) ? NULL_ADDRESS : t),
      );

      const _limits = _assets.map(_ => MAX_INT);

      swaps = swaps.concat(_swaps);
      assets = assets.concat(_assets);
      limits = limits.concat(_limits);
    }

    const funds = {
      sender: this.augustusAddress,
      recipient: this.augustusAddress,
      fromInternalBalance: false,
      toInternalBalance: false,
    };

    const params: VerifiedParam = [
      side === SwapSide.SELL ? SwapTypes.SwapExactIn : SwapTypes.SwapExactOut,
      side === SwapSide.SELL ? swaps : swaps.reverse(),
      assets,
      funds,
      limits,
      MAX_UINT,
    ];

    return params;
  }

  getTokenFromAddress(address: Address): Token {
    // In this Dex decimals are not used
    return { address, decimals: 0 };
  }

  //checks if vault has been preapproved to have access to amount of from token
  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<OptimizedVerifiedData>,
    srcToken: Token,
    _0: Token,
    _1: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<OptimizedVerifiedData>, ExchangeTxInfo]> {
    if (!options.isDirectMethod) {
      return [
        optimalSwapExchange,
        {
          deadline: BigInt(getLocalDeadlineAsFriendlyPlaceholder()),
        },
      ];
    }

    assert(
      optimalSwapExchange.data !== undefined,
      `preProcessTransaction: data field is missing`,
    );

    let isApproved: boolean | undefined;

    try {
      this.erc20Contract.options.address =
        this.dexHelper.config.wrapETH(srcToken).address;
      const allowance = await this.erc20Contract.methods
        .allowance(this.augustusAddress, this.vaultAddress)
        .call(undefined, 'latest');
      isApproved =
        BigInt(allowance.toString()) >= BigInt(optimalSwapExchange.srcAmount);
    } catch (e) {
      this.logger.error(
        `preProcessTransaction failed to retrieve allowance info: `,
        e,
      );
    }

    return [
      {
        ...optimalSwapExchange,
        data: {
          ...optimalSwapExchange.data,
          isApproved,
        },
      },
      {
        deadline: BigInt(getLocalDeadlineAsFriendlyPlaceholder()),
      },
    ];
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedBalancerV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const params = this.getVerifiedParam(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      data,
      side,
    );

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          'swaps[]': {
            poolId: 'bytes32',
            assetInIndex: 'uint256',
            assetOutIndex: 'uint256',
            amount: 'uint256',
            userData: 'bytes',
          },
          assets: 'address[]',
          funds: {
            sender: 'address',
            fromInternalBalance: 'bool',
            recipient: 'address',
            toInternalBalance: 'bool',
          },
          limits: 'int256[]',
          deadline: 'uint256',
        },
      },
      {
        swaps: params[1],
        assets: params[2],
        funds: params[3],
        limits: params[4],
        deadline: params[5],
      },
    );

    return {
      targetExchange: this.vaultAddress,
      payload,
      networkFee: '0',
    };
  }

  //constructs params for direct swap
  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    expectedAmount: NumberAsString,
    data: OptimizedBalancerV2Data,
    side: SwapSide,
    permit: string,
    uuid: string,
    feePercent: NumberAsString,
    deadline: NumberAsString,
    partner: string,
    beneficiary: string,
    contractMethod?: string,
  ): TxInfo<BalancerV2DirectParam> {
    if (
      contractMethod !== DirectMethods.directSell &&
      contractMethod !== DirectMethods.directBuy
    ) {
      throw new Error(`Invalid contract method ${contractMethod}`);
    }

    let isApproved: boolean = data.isApproved!;
    if (data.isApproved === undefined) {
      this.logger.warn(`isApproved is undefined, defaulting to false`);
    }

    const [, swaps, assets, funds, limits, _deadline] = this.getVerifiedParam(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      data,
      side,
    );

    const swapParams: VerifiedDirectParam = [
      swaps,
      assets,
      funds,
      limits,
      srcAmount,
      destAmount,
      expectedAmount,
      _deadline,
      feePercent,
      this.vaultAddress,
      partner,
      isApproved,
      beneficiary,
      permit,
      uuidToBytes16(uuid),
    ];

    const encoder = (...params: VerifiedDirectParam) => {
      return this.directSwapIface.encodeFunctionData(
        side === SwapSide.SELL
          ? DirectMethods.directSell
          : DirectMethods.directBuy,
        [params],
      );
    };

    return {
      params: swapParams,
      encoder,
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedBalancerV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const params = this.getVerifiedParam(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      data,
      side,
    );

    const swapData = this.eventPools.vaultInterface.encodeFunctionData(
      'batchSwap',
      params,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.vaultAddress,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    this.eventPools.allPools = await this.eventPools.fetchAllSubgraphPools();
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    const poolsWithToken = this.eventPools.allPools.filter(pool =>
      pool.mainTokens.some(mainToken =>
        isSameAddress(mainToken.address, tokenAddress),
      ),
    );

    const variables = {
      poolIds: poolsWithToken.map(pool => pool.id),
      count,
    };

    //TODO: verify why polygon pools have no liquidity and update the query
    //it must filter with liquidity
    const query = `query ($poolIds: [String!]!, $count: Int) {
      pools (first: $count, orderBy: totalLiquidity, orderDirection: desc,
           where: {id_in: $poolIds,
                   swapEnabled: true,
            }) {
        address
        totalLiquidity
        tokens {
          address
          decimals
        }
      }
    }`;
    const { data } = await this.dexHelper.httpRequest.post<{
      data: {
        pools: {
          address: string;
          totalLiquidity: string;
          tokens: { address: string; decimals: number }[];
        }[];
      };
    }>(
      this.subgraphURL,
      {
        query,
        variables,
      },
      SUBGRAPH_TIMEOUT,
    );

    if (!(data && data.pools))
      throw new Error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );

    return _.map(data.pools, pool => {
      const subgraphPool = poolsWithToken.find(poolWithToken =>
        isSameAddress(poolWithToken.address, pool.address),
      )!;

      return {
        exchange: this.dexKey,
        address: pool.address.toLowerCase(),
        connectorTokens: subgraphPool.mainTokens.filter(
          token => !isSameAddress(tokenAddress, token.address),
        ),
        liquidityUSD: parseFloat(pool.totalLiquidity),
      };
    });
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }

  //Returns cached poolState if blockNumber matches cached value. Resets if not.
  private getNonEventPoolStateCache(blockNumber: number): PoolStateMap {
    if (this.nonEventPoolStateCache.blockNumber !== blockNumber)
      this.nonEventPoolStateCache.poolState = {};
    return this.nonEventPoolStateCache.poolState;
  }

  // Update poolState cache.
  //If same blockNumber as current cache then update with new pool state.
  //If different blockNumber overwrite cache with latest.
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
