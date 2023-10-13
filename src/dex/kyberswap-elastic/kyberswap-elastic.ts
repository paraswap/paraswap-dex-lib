import { defaultAbiCoder, Interface } from '@ethersproject/abi';
import { pack } from '@ethersproject/solidity';
import { DeepReadonly } from 'ts-essentials';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';
import _ from 'lodash';

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
} from '../../types';
import {
  AssetType,
  DEFAULT_ID_ERC20,
  DEFAULT_ID_ERC20_AS_STRING,
} from '../../lib/tokens/types';
import { SwapSide, Network, CACHE_PREFIX } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import {
  getBigIntPow,
  getDexKeysWithNetwork,
  interpolate,
  isTruthy,
} from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { BalanceRequest, getBalances } from '../../lib/tokens/balancer-fetcher';
import {
  SimpleExchange,
  getLocalDeadlineAsFriendlyPlaceholder,
} from '../simple-exchange';

import MultiCallABI from '../../abi/multi-v2.json';
import RouterABI from '../../abi/kyberswap-elastic/IRouter.json';
import QuoterABI from '../../abi/kyberswap-elastic/IQuoterV2.json';

import {
  KyberswapElasticData,
  DexParams,
  PoolState,
  KyberElasticParam,
  KyberElasticFunctions,
  OutputResult, PoolPairsInfo,
} from './types';
import { KyberswapElasticConfig, Adapters } from './config';
import {
  KS_ELASTIC_EFFICIENCY_FACTOR,
  KS_ELASTIC_POOL_SEARCH_OVERHEAD,
  KS_ELASTIC_QUOTE_GASLIMIT,
  KS_ELASTIC_TICK_BASE_OVERHEAD,
  KS_ELASTIC_TICK_GAS_COST,
} from './constants';
import { KyberswapElasticEventPool } from './kyberswap-elastic-pool';
import { ksElasticMath } from './contract-math/kyberswap-elastic-math';
import { ERR_DECODE, ERR_POOL_DOES_NOT_EXIST } from './errors';

const CLEAN_NOT_EXISTING_POOL_TTL_MS = 60 * 60 * 24 * 1000; // 24 hours
const CLEAN_NOT_EXISTING_POOL_INTERVAL_MS = 30 * 60 * 1000; // Once in 30 minutes

export class KyberSwapElastic
  extends SimpleExchange
  implements IDex<KyberswapElasticData>
{
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(KyberswapElasticConfig);

  logger: Logger;

  readonly eventPools: Record<string, KyberswapElasticEventPool | null> = {};
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;
  readonly isFeeOnTransferSupported = false;
  readonly routerIface = new Interface(RouterABI);
  readonly quoterIface = new Interface(QuoterABI);

  private _intervalTask?: NodeJS.Timeout;
  private notExistingPoolSetKey: string;
  private multicall: Contract;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected config = KyberswapElasticConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey + '-' + network);

    // To receive revert reasons
    this.dexHelper.web3Provider.eth.handleRevert = false;

    // Normalise once all config addresses and use across all scenarios
    this.config = this._toLowerForAllConfigAddresses();

    this.multicall = new this.dexHelper.web3Provider.eth.Contract(
      MultiCallABI as AbiItem[],
      this.dexHelper.config.data.multicallV2Address,
    );

    this.notExistingPoolSetKey =
      `${CACHE_PREFIX}_${network}_${dexKey}_not_existings_pool_set`.toLowerCase();
  }

  get supportedFees() {
    return this.config.supportedFees;
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    if (!this.dexHelper.config.isSlave) {
      const cleanExpiredNotExistingPoolsKeys = async () => {
        const maxTimestamp = Date.now() - CLEAN_NOT_EXISTING_POOL_TTL_MS;
        await this.dexHelper.cache.zremrangebyscore(
          this.notExistingPoolSetKey,
          0,
          maxTimestamp,
        );
      };

      this._intervalTask = setInterval(
        cleanExpiredNotExistingPoolsKeys.bind(this),
        CLEAN_NOT_EXISTING_POOL_INTERVAL_MS,
      );
    }
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  // Build an event based pool with all the info to create inside
  // a cache key name poolKey
  async addMasterPool(poolKey: string, blockNumber: number): Promise<boolean> {
    const _pairs = await this.dexHelper.cache.hget(this.dexmapKey, poolKey);
    if (!_pairs) {
      this.logger.warn(
        `did not find poolConfig in for key ${this.dexmapKey} ${poolKey}`,
      );
      return false;
    }

    const poolInfo: PoolPairsInfo = JSON.parse(_pairs);

    const pool = await this._getPool(
      poolInfo.token0,
      poolInfo.token1,
      BigInt(poolInfo.swapFeeUnits),
      blockNumber,
    );

    if (!pool) {
      return false;
    }

    return true;
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
    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    const [_srcAddress, _destAddress] = this._getLoweredAddresses(
      _srcToken,
      _destToken,
    );

    if (_srcAddress === _destAddress) return [];

    const pools = (
      await Promise.all(
        this.supportedFees.map(async swapFeeUnits =>
          this._getPool(_srcAddress, _destAddress, swapFeeUnits, blockNumber),
        ),
      )
    ).filter(pool => pool);

    if (pools.length === 0) return [];

    return pools.map(pool =>
      this._getPoolIdentifier(_srcAddress, _destAddress, pool!.swapFeeUnits),
    );
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
  ): Promise<null | ExchangePrices<KyberswapElasticData>> {
    try {
      const _srcToken = this.dexHelper.config.wrapETH(srcToken);
      const _destToken = this.dexHelper.config.wrapETH(destToken);

      const [_srcAddress, _destAddress] = this._getLoweredAddresses(
        _srcToken,
        _destToken,
      );

      if (_srcAddress === _destAddress) return null;

      let selectedPools: KyberswapElasticEventPool[] = [];

      if (!limitPools) {
        selectedPools = (
          await Promise.all(
            this.supportedFees.map(async swapFeeUnits => {
              const locallyFoundPool =
                this.eventPools[
                  this._getPoolIdentifier(
                    _srcAddress,
                    _destAddress,
                    swapFeeUnits,
                  )
                ];
              if (locallyFoundPool) return locallyFoundPool;

              const newlyFetchedPool = await this._getPool(
                _srcAddress,
                _destAddress,
                swapFeeUnits,
                blockNumber,
              );
              return newlyFetchedPool;
            }),
          )
        ).filter(isTruthy);
      } else {
        const pairIdentifierWithoutFee = this._getPoolIdentifier(
          _srcAddress,
          _destAddress,
          0n,
          // Trim from 0 swapFeeUnits postfix, so it become comparable
        ).slice(0, -1);

        const poolIdentifiers = limitPools.filter(identifier =>
          identifier.startsWith(pairIdentifierWithoutFee),
        );

        selectedPools = (
          await Promise.all(
            poolIdentifiers.map(async identifier => {
              let locallyFoundPool = this.eventPools[identifier];
              if (locallyFoundPool) return locallyFoundPool;

              const [, srcAddress, destAddress, swapFeeUnits] =
                identifier.split('_');
              const newlyFetchedPool = await this._getPool(
                srcAddress,
                destAddress,
                BigInt(swapFeeUnits),
                blockNumber,
              );
              return newlyFetchedPool;
            }),
          )
        ).filter(isTruthy);
      }

      if (selectedPools.length === 0) return null;

      const poolsToUse = selectedPools.reduce(
        (acc, pool) => {
          let state = pool.getState(blockNumber);
          if (state === null) {
            this.logger.trace(
              `${this.dexKey}: State === null. Fallback to rpc ${pool.name}`,
            );
            acc.poolWithoutState.push(pool);
          } else {
            acc.poolWithState.push(pool);
          }
          return acc;
        },
        {
          poolWithState: [] as KyberswapElasticEventPool[],
          poolWithoutState: [] as KyberswapElasticEventPool[],
        },
      );

      const rpcResultsPromise = this._getPricingFromRpc(
        _srcToken,
        _destToken,
        amounts,
        side,
        poolsToUse.poolWithoutState,
      );

      const states = poolsToUse.poolWithState.map(
        p => p.getState(blockNumber)!,
      );

      const unitAmount = getBigIntPow(
        side == SwapSide.SELL ? _srcToken.decimals : _destToken.decimals,
      );

      const _amounts = [...amounts.slice(1)];

      const [token0] = this._sortTokens(_srcAddress, _destAddress);

      const isToken0 = token0 === _srcAddress ? true : false;

      const result = await Promise.all(
        poolsToUse.poolWithState.map(async (pool, i) => {
          const state = states[i];

          if (state.poolData.baseL <= 0n) {
            this.logger.trace(`pool have 0 liquidity`);
            return null;
          }

          const balanceDestToken =
            _destAddress === pool.token0 ? state.balance0 : state.balance1;

          const unitResult = this._getOutputs(
            state,
            [unitAmount],
            isToken0,
            side,
            balanceDestToken,
          );
          const pricesResult = this._getOutputs(
            state,
            _amounts,
            isToken0,
            side,
            balanceDestToken,
          );

          if (!unitResult || !pricesResult) {
            this.logger.debug('Prices or unit is not calculated');
            return null;
          }

          const prices = [0n, ...pricesResult.outputs];
          const gasCost = [
            0,
            ...pricesResult.outputs.map((p, index) => {
              if (p == 0n) {
                return 0;
              } else {
                return (
                  KS_ELASTIC_POOL_SEARCH_OVERHEAD +
                  KS_ELASTIC_TICK_BASE_OVERHEAD +
                  pricesResult.tickCounts[index] * KS_ELASTIC_TICK_GAS_COST
                );
              }
            }),
          ];
          return {
            unit: unitResult.outputs[0],
            prices,
            data: {
              path: [
                {
                  tokenIn: _srcAddress,
                  tokenOut: _destAddress,
                  swapFeeUnits: pool.swapFeeUnits.toString(),
                },
              ],
            },
            poolIdentifier: this._getPoolIdentifier(
              pool.token0,
              pool.token1,
              pool.swapFeeUnits,
            ),
            exchange: this.dexKey,
            gasCost: gasCost,
            poolAddresses: [pool.poolAddress],
          };
        }),
      );
      const rpcResults = await rpcResultsPromise;

      const notNullResult = result.filter(
        res => res !== null,
      ) as ExchangePrices<KyberswapElasticData>;

      if (rpcResults) {
        rpcResults.forEach(r => {
          if (r) {
            notNullResult.push(r);
          }
        });
      }

      return notNullResult;
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
  getCalldataGasCost(
    poolPrices: PoolPrices<KyberswapElasticData>,
  ): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Returns a pool identifier that can be used
  // for a given swap. Use:
  // ${dexKey}_${poolAddress} as a poolIdentifier
  _getPoolIdentifier(
    srcAddress: Address,
    destAddress: Address,
    swapFeeUnits: bigint,
  ) {
    const tokenAddresses = this._sortTokens(srcAddress, destAddress).join('_');
    return `${this.dexKey}_${tokenAddresses}_${swapFeeUnits.toString()}`;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: KyberswapElasticData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { path: rawPath } = data;
    const path = this._encodePath(rawPath, side);

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          path: 'bytes',
          deadline: 'uint256',
        },
      },
      {
        path,
        deadline: getLocalDeadlineAsFriendlyPlaceholder(),
      },
    );

    return {
      targetExchange: this.config.router,
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
    data: KyberswapElasticData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? KyberElasticFunctions.quoteExactInputSingle
        : KyberElasticFunctions.quoteExactOutputSingle;

    const path = this._encodePath(data.path, side);
    const swapFunctionParams: KyberElasticParam =
      side === SwapSide.SELL
        ? {
            recipient: this.augustusAddress,
            deadline: getLocalDeadlineAsFriendlyPlaceholder(),
            amountIn: srcAmount,
            amountOutMinimum: destAmount,
            path,
          }
        : {
            recipient: this.augustusAddress,
            deadline: getLocalDeadlineAsFriendlyPlaceholder(),
            amountOut: destAmount,
            amountInMaximum: srcAmount,
            path,
          };
    const swapData = this.routerIface.encodeFunctionData(swapFunction, [
      swapFunctionParams,
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.config.router,
    );
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const _tokenAddress = tokenAddress.toLowerCase();

    const res = await this._querySubgraph(
      `query ($token: Bytes!, $count: Int) {
                pools0: pools(first: $count, orderBy: totalValueLockedUSD, orderDirection: desc, where: {token0: $token}) {
                id
                token0 {
                  id
                  decimals
                }
                token1 {
                  id
                  decimals
                }
                totalValueLockedUSD
              }
              pools1: pools(first: $count, orderBy: totalValueLockedUSD, orderDirection: desc, where: {token1: $token}) {
                id
                token0 {
                  id
                  decimals
                }
                token1 {
                  id
                  decimals
                }
                totalValueLockedUSD
              }
            }`,
      {
        token: _tokenAddress,
        count: limit,
      },
    );

    if (!(res && res.pools0 && res.pools1)) {
      this.logger.error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );
      return [];
    }

    const pools0 = _.map(res.pools0, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [
        {
          address: pool.token1.id.toLowerCase(),
          decimals: parseInt(pool.token1.decimals),
        },
      ],
      liquidityUSD:
        parseFloat(pool.totalValueLockedUSD) * KS_ELASTIC_EFFICIENCY_FACTOR,
    }));

    const pools1 = _.map(res.pools1, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [
        {
          address: pool.token0.id.toLowerCase(),
          decimals: parseInt(pool.token0.decimals),
        },
      ],
      liquidityUSD:
        parseFloat(pool.totalValueLockedUSD) * KS_ELASTIC_EFFICIENCY_FACTOR,
    }));

    const pools = _.slice(
      _.sortBy(_.concat(pools0, pools1), [pool => -1 * pool.liquidityUSD]),
      0,
      limit,
    );
    return pools;
  }

  private async _querySubgraph(
    query: string,
    variables: Object,
    timeout = 30000,
  ) {
    try {
      const res = await this.dexHelper.httpRequest.post(
        this.config.subgraphURL as string,
        { query, variables },
        undefined,
        { timeout: timeout },
      );
      return res.data;
    } catch (e) {
      this.logger.error(`${this.dexKey}: can not query subgraph: `, e);
      return {};
    }
  }

  releaseResources() {
    if (this._intervalTask !== undefined) {
      clearInterval(this._intervalTask);
      this._intervalTask = undefined;
    }
  }

  private _sortTokens(srcAddress: Address, destAddress: Address) {
    return [srcAddress, destAddress].sort((a, b) => (a < b ? -1 : 1));
  }

  private async _getPool(
    srcAddress: Address,
    destAddress: Address,
    swapFeeUnits: bigint,
    blockNumber: number,
  ): Promise<KyberswapElasticEventPool | null> {
    let pool =
      this.eventPools[
        this._getPoolIdentifier(srcAddress, destAddress, swapFeeUnits)
      ];

    if (pool === undefined) {
      const [token0, token1] = this._sortTokens(srcAddress, destAddress);

      const key = `${token0}_${token1}_${swapFeeUnits}`.toLowerCase();

      // Check if the pool key is in the notExistingPool set,
      // if yes, return null without initialize a new pool instance.
      const notExistingPoolScore = await this.dexHelper.cache.zscore(
        this.notExistingPoolSetKey,
        key,
      );
      const poolDoesNotExist = notExistingPoolScore !== null;
      if (poolDoesNotExist) {
        this.eventPools[
          this._getPoolIdentifier(srcAddress, destAddress, swapFeeUnits)
        ] = null;
        return null;
      }

      // Store this pool
      await this.dexHelper.cache.hset(
        this.dexmapKey,
        key,
        JSON.stringify({
          token0,
          token1,
          swapFeeUnits: swapFeeUnits.toString(),
        }),
      );

      this.logger.trace(`Starting to listen to new pool: ${key}`);
      pool = new KyberswapElasticEventPool(
        this.dexKey,
        this.network,
        this.dexHelper,
        this.logger,
        this.config,
        swapFeeUnits,
        token0,
        token1,
      );

      try {
        await pool.initialize(blockNumber, {
          initCallback: (state: DeepReadonly<PoolState>) => {
            // Really hacky, we need to push poolAddress so that we subscribeToLogs in StatefulEventSubscriber
            pool!.addressesSubscribed[0] = state.pool;
            pool!.poolAddress = state.pool;
          },
        });
      } catch (e) {
        if (
          e instanceof Error &&
          (e.message.endsWith(ERR_POOL_DOES_NOT_EXIST) ||
            e.message.search(ERR_DECODE) != -1)
        ) {
          // No need to await here, we push the pool into the notExistingPool set without blocking
          this.dexHelper.cache.zadd(
            this.notExistingPoolSetKey,
            [Date.now(), key],
            'NX',
          );

          // Pool does not exist for this swapFeeUnits, so we can set it to null,
          // to prevent more requests for this pool
          pool = null;
          this.logger.trace(
            `${this.dexHelper}: Pool: srcAddress=${srcAddress}, destAddress=${destAddress}, swapFeeUnits=${swapFeeUnits} not found`,
            e,
          );
        } else {
          // Unexpected Error. Break execution. Do not save the pool in this.eventPools
          this.logger.error(
            `${this.dexKey}: Can not generate pool state for srcAddress=${srcAddress}, destAddress=${destAddress}, swapFeeUnits=${swapFeeUnits} pool`,
            e,
          );
          throw new Error('Cannot generate pool state');
        }
      }

      if (pool !== null) {
        const allEventPools = Object.values(this.eventPools);
        this.logger.info(
          `Starting to listen to new non-null pool: ${key}. Already following ${allEventPools
            // Not that I like this reduce, but since it is done only on initialization, expect this to be ok
            .reduce(
              (acc, curr) => (curr !== null ? ++acc : acc),
              0,
            )} non-null pools or ${allEventPools.length} total pools`,
        );
      }

      this.eventPools[
        this._getPoolIdentifier(srcAddress, destAddress, swapFeeUnits)
      ] = pool;
    }
    return pool;
  }

  private async _getPricingFromRpc(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    pools: KyberswapElasticEventPool[],
  ): Promise<ExchangePrices<KyberswapElasticData> | null> {
    if (pools.length === 0) {
      return null;
    }
    this.logger.warn(`fallback to rpc for ${pools.length} pool(s)`);

    const requests = pools.map<BalanceRequest>(
      pool => ({
        owner: pool.poolAddress,
        asset: side == SwapSide.SELL ? from.address : to.address,
        assetType: AssetType.ERC20,
        ids: [
          {
            id: DEFAULT_ID_ERC20,
            spenders: [],
          },
        ],
      }),
      [],
    );

    const balances = await getBalances(this.dexHelper.multiWrapper, requests);

    pools = pools.filter((pool, index) => {
      const balance = balances[index].amounts[DEFAULT_ID_ERC20_AS_STRING];
      if (balance >= amounts[amounts.length - 1]) {
        return true;
      }
      this.logger.warn(
        `[${this.network}][${pool.parentName}] have no balance ${pool.poolAddress} ${from.address} ${to.address}. (Balance: ${balance})`,
      );
      return false;
    });

    pools.forEach(pool => {
      this.logger.warn(
        `[${this.network}][${pool.parentName}] fallback to rpc for ${pool.name}`,
      );
    });

    const unitVolume = getBigIntPow(
      (side === SwapSide.SELL ? from : to).decimals,
    );

    const chunks = amounts.length - 1;

    const _width = Math.floor(chunks / this.config.chunksCount);

    const _amounts = [unitVolume].concat(
      Array.from(Array(this.config.chunksCount).keys()).map(
        i => amounts[(i + 1) * _width],
      ),
    );

    const calldata = pools.map(pool =>
      _amounts.map(_amount => ({
        target: this.config.quoter,
        gasLimit: KS_ELASTIC_QUOTE_GASLIMIT,
        callData:
          side === SwapSide.SELL
            ? this.quoterIface.encodeFunctionData(
                KyberElasticFunctions.quoteExactInputSingle,
                [
                  {
                    tokenIn: from.address,
                    tokenOut: to.address,
                    amountIn: _amount,
                    feeUnits: pool.swapFeeUnits,
                    limitSqrtP: 0n,
                  },
                ],
              )
            : this.quoterIface.encodeFunctionData(
                KyberElasticFunctions.quoteExactOutputSingle,
                [
                  {
                    tokenIn: from.address,
                    tokenOut: to.address,
                    amount: _amount,
                    feeUnits: pool.swapFeeUnits,
                    limitSqrtP: 0n,
                  },
                ],
              ),
      })),
    );

    const data = await this.multicall.methods.multicall(calldata.flat()).call();

    const decode = (j: number): bigint => {
      if (!data.returnData[j].success) {
        return 0n;
      }
      const decoded = defaultAbiCoder.decode(
        ['uint256'],
        data.returnData[j].returnData,
      );
      return BigInt(decoded[0][1].toString());
    };

    let i = 0;
    const result = pools.map(pool => {
      const _rates = _amounts.map(() => decode(i++));
      const unit: bigint = _rates[0];

      const prices = interpolate(
        _amounts.slice(1),
        _rates.slice(1),
        amounts,
        side,
      );

      return <PoolPrices<KyberswapElasticData>>{
        prices,
        unit,
        data: {
          path: [
            {
              tokenIn: from.address,
              tokenOut: to.address,
              swapFeeUnits: pool.swapFeeUnits.toString(),
            },
          ],
        },
        poolIdentifier: this._getPoolIdentifier(
          pool.token0,
          pool.token1,
          pool.swapFeeUnits,
        ),
        exchange: this.dexKey,
        gasCost: prices.map(p => (p === 0n ? 0 : KS_ELASTIC_QUOTE_GASLIMIT)),
        poolAddresses: [pool.poolAddress],
      };
    });

    return result;
  }

  // Normalise KyberswapElasticConfig
  private _toLowerForAllConfigAddresses(): DexParams {
    const newConfig: DexParams = {
      router: this.config.router.toLowerCase(),
      quoter: this.config.quoter.toLowerCase(),
      factory: this.config.factory.toLowerCase(),
      positionManager: this.config.positionManager.toLowerCase(),
      ticksFeesReader: this.config.ticksFeesReader.toLowerCase(),
      tokenPositionDescriptor:
        this.config.tokenPositionDescriptor.toLowerCase(),
      supportedFees: this.config.supportedFees,
      chunksCount: this.config.chunksCount,
      poolInitHash: this.config.poolInitHash,
      subgraphURL: this.config.subgraphURL,
    };
    return newConfig;
  }

  // Returns addresses in lower case
  private _getLoweredAddresses(srcToken: Token, destToken: Token) {
    return [srcToken.address.toLowerCase(), destToken.address.toLowerCase()];
  }

  // Returns encoded path of a trade to call to the router contract
  private _encodePath(
    path: {
      tokenIn: Address;
      tokenOut: Address;
      swapFeeUnits: NumberAsString;
    }[],
    side: SwapSide,
  ): string {
    if (path.length === 0) {
      this.logger.error(
        `${this.dexKey}: Received invalid path=${path} for side=${side} to encode`,
      );
      return '0x';
    }

    const { _path, types } = path.reduce(
      (
        { _path, types }: { _path: string[]; types: string[] },
        curr,
        index,
      ): { _path: string[]; types: string[] } => {
        if (index === 0) {
          return {
            types: ['address', 'uint24', 'address'],
            _path: [curr.tokenIn, curr.swapFeeUnits, curr.tokenOut],
          };
        } else {
          return {
            types: [...types, 'uint24', 'address'],
            _path: [..._path, curr.swapFeeUnits, curr.tokenOut],
          };
        }
      },
      { _path: [], types: [] },
    );

    return side === SwapSide.BUY
      ? pack(types.reverse(), _path.reverse())
      : pack(types, _path);
  }

  private _getOutputs(
    state: DeepReadonly<PoolState>,
    amounts: bigint[],
    isToken0: boolean,
    side: SwapSide,
    destTokenBalance: bigint,
  ): OutputResult | null {
    try {
      const outputsResult = ksElasticMath.queryOutputs(
        state,
        amounts,
        isToken0,
        side,
      );

      if (side === SwapSide.SELL) {
        if (outputsResult.outputs[0] > destTokenBalance) {
          return null;
        }

        for (let i = 0; i < outputsResult.outputs.length; i++) {
          if (outputsResult.outputs[i] > destTokenBalance) {
            outputsResult.outputs[i] = 0n;
            outputsResult.tickCounts[i] = 0;
          }
        }
      } else {
        if (amounts[0] > destTokenBalance) {
          return null;
        }

        // This may be improved by first checking outputs and requesting outputs
        // only for amounts that makes more sense, but I don't think this is really
        // important now
        for (let i = 0; i < amounts.length; i++) {
          if (amounts[i] > destTokenBalance) {
            outputsResult.outputs[i] = 0n;
            outputsResult.tickCounts[i] = 0;
          }
        }
      }

      return outputsResult;
    } catch (e) {
      this.logger.debug(
        `${this.dexKey}: received error in _getOutputs while calculating outputs`,
        e,
      );
      return null;
    }
  }
}
