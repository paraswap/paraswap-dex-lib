import { defaultAbiCoder } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { AbiItem } from 'web3-utils';
import { pack } from '@ethersproject/solidity';
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
} from '../../types';
import { SwapSide, Network, CACHE_PREFIX } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork, interpolate } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AlgebraData, DexParams, PoolState } from './types';
import {
  SimpleExchange,
  getLocalDeadlineAsFriendlyPlaceholder,
} from '../simple-exchange';
import { AlgebraConfig, Adapters } from './config';
import { AlgebraEventPool } from './algebra-pool';
import { Contract } from 'web3-eth-contract';
import { Interface } from 'ethers/lib/utils';
import UniswapV3RouterABI from '../../abi/uniswap-v3/UniswapV3Router.abi.json';
import AlgebraQuoterABI from '../../abi/algebra/AlgebraQuoter.abi.json';
import UniswapV3MultiABI from '../../abi/uniswap-v3/UniswapMulti.abi.json';
import AlgebraStateMulticallABI from '../../abi/algebra/AlgebraStateMulticall.abi.json';
import {
  OutputResult,
  UniswapV3Functions,
  UniswapV3SimpleSwapParams,
} from '../uniswap-v3/types';
import { AlgebraMath } from './lib/AlgebraMath';

type PoolPairsInfo = {
  token0: Address;
  token1: Address;
};

const ALGEBRA_CLEAN_NOT_EXISTING_POOL_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
const ALGEBRA_CLEAN_NOT_EXISTING_POOL_INTERVAL_MS = 30 * 60 * 1000; // Once in 30 minutes
const ALGEBRA_EFFICIENCY_FACTOR = 3;
const ALGEBRA_TICK_GAS_COST = 24_000; // Ceiled
const ALGEBRA_TICK_BASE_OVERHEAD = 75_000;
const ALGEBRA_POOL_SEARCH_OVERHEAD = 10_000;
const ALGEBRA_QUOTE_GASLIMIT = 2_000_000;

export class Algebra extends SimpleExchange implements IDex<AlgebraData> {
  readonly isFeeOnTransferSupported: boolean = false;
  protected eventPools: Record<string, AlgebraEventPool | null> = {};

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  intervalTask?: NodeJS.Timeout;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(AlgebraConfig);

  logger: Logger;

  private uniswapMulti: Contract;
  private stateMultiContract: Contract;

  private notExistingPoolSetKey: string;

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly routerIface = new Interface(UniswapV3RouterABI), // same abi as uniswapV3
    readonly quoterIface = new Interface(AlgebraQuoterABI),
    protected config = AlgebraConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey + '-' + network);
    this.uniswapMulti = new this.dexHelper.web3Provider.eth.Contract(
      UniswapV3MultiABI as AbiItem[],
      this.config.uniswapMulticall,
    );
    this.stateMultiContract = new this.dexHelper.web3Provider.eth.Contract(
      AlgebraStateMulticallABI as AbiItem[],
      this.config.algebraStateMulticall,
    );

    this.dexHelper.web3Provider.eth.handleRevert = false;

    this.config = this._toLowerForAllConfigAddresses();

    this.notExistingPoolSetKey =
      `${CACHE_PREFIX}_${network}_${dexKey}_not_existings_pool_set`.toLowerCase();
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPoolIdentifier(srcAddress: Address, destAddress: Address) {
    const tokenAddresses = this._sortTokens(srcAddress, destAddress).join('_');
    return `${this.dexKey}_${tokenAddresses}`;
  }

  async initializePricing(blockNumber: number) {
    if (!this.dexHelper.config.isSlave) {
      const cleanExpiredNotExistingPoolsKeys = async () => {
        const maxTimestamp =
          Date.now() - ALGEBRA_CLEAN_NOT_EXISTING_POOL_TTL_MS;
        await this.dexHelper.cache.zremrangebyscore(
          this.notExistingPoolSetKey,
          0,
          maxTimestamp,
        );
      };

      this.intervalTask = setInterval(
        cleanExpiredNotExistingPoolsKeys.bind(this),
        ALGEBRA_CLEAN_NOT_EXISTING_POOL_INTERVAL_MS,
      );
    }
  }

  async getPool(
    srcAddress: Address,
    destAddress: Address,
    blockNumber: number,
  ): Promise<AlgebraEventPool | null> {
    let pool = this.eventPools[this.getPoolIdentifier(srcAddress, destAddress)];

    if (pool === undefined) {
      const [token0, token1] = this._sortTokens(srcAddress, destAddress);

      const key = `${token0}_${token1}`.toLowerCase();

      const notExistingPoolScore = await this.dexHelper.cache.zscore(
        this.notExistingPoolSetKey,
        key,
      );

      const poolDoesNotExist = notExistingPoolScore !== null;

      if (poolDoesNotExist) {
        this.eventPools[this.getPoolIdentifier(srcAddress, destAddress)] = null;
        return null;
      }

      await this.dexHelper.cache.hset(
        this.dexmapKey,
        key,
        JSON.stringify({
          token0,
          token1,
        }),
      );

      this.logger.trace(`starting to listen to new pool: ${key}`);
      pool = new AlgebraEventPool(
        this.dexHelper,
        this.dexKey,
        this.stateMultiContract,
        this.erc20Interface,
        this.config.factory,
        token0,
        token1,
        this.logger,
        this.cacheStateKey,
        this.config.initHash,
        this.config.deployer,
      );

      try {
        await pool.initialize(blockNumber, {
          initCallback: (state: DeepReadonly<PoolState>) => {
            //really hacky, we need to push poolAddress so that we subscribeToLogs in StatefulEventSubscriber
            pool!.addressesSubscribed[0] = state.pool;
            pool!.poolAddress = state.pool;
          },
        });
      } catch (e) {
        if (
          // most zkEVM rpcs fails with "cannot execute unsigned transaction" issue. Prefer to flag pool as non existing instaed of trying to generateState on earch round
          this.network === Network.ZKEVM ||
          (e instanceof Error && e.message.endsWith('Pool does not exist'))
        ) {
          // no need to await we want the set to have the pool key but it's not blocking
          this.dexHelper.cache.zadd(
            this.notExistingPoolSetKey,
            [Date.now(), key],
            'NX',
          );

          // Pool does not exist for this pair, so we can set it to null
          // to prevent more requests for this pool
          pool = null;
          this.logger.trace(
            `${this.dexHelper}: Pool: srcAddress=${srcAddress}, destAddress=${destAddress} not found`,
            e,
          );
        } else {
          // Unexpected Error. Break execution. Do not save the pool in this.eventPools
          this.logger.error(
            `${this.dexKey}: Can not generate pool state for srcAddress=${srcAddress}, destAddress=${destAddress}pool`,
            e,
          );
          throw new Error('Cannot generate pool state');
        }
      }

      if (pool !== null) {
        const allEventPools = Object.values(this.eventPools);
        this.logger.info(
          `starting to listen to new non-null pool: ${key}. Already following ${allEventPools
            // Not that I like this reduce, but since it is done only on initialization, expect this to be ok
            .reduce(
              (acc, curr) => (curr !== null ? ++acc : acc),
              0,
            )} non-null pools or ${allEventPools.length} total pools`,
        );
      }

      this.eventPools[this.getPoolIdentifier(srcAddress, destAddress)] = pool;
    }
    return pool;
  }

  async addMasterPool(poolKey: string, blockNumber: number): Promise<boolean> {
    const _pairs = await this.dexHelper.cache.hget(this.dexmapKey, poolKey);
    if (!_pairs) {
      this.logger.warn(
        `did not find poolConfig in for key ${this.dexmapKey} ${poolKey}`,
      );
      return false;
    }

    const poolInfo: PoolPairsInfo = JSON.parse(_pairs);

    const pool = await this.getPool(
      poolInfo.token0,
      poolInfo.token1,
      blockNumber,
    );

    if (!pool) {
      return false;
    }

    return true;
  }

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

    const pool = await this.getPool(_srcAddress, _destAddress, blockNumber);
    if (!pool) return [];
    return [this.getPoolIdentifier(_srcAddress, _destAddress)];
  }

  async getPricingFromRpc(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    pool: AlgebraEventPool,
  ): Promise<ExchangePrices<AlgebraData> | null> {
    this.logger.warn(
      `fallback to rpc for ${from.address}_${to.address}_${pool.name}_${pool.poolAddress} pool(s)`,
    );

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

    const calldata = _amounts.map(_amount => ({
      target: this.config.quoter,
      gasLimit: ALGEBRA_QUOTE_GASLIMIT,
      callData:
        side === SwapSide.SELL
          ? this.quoterIface.encodeFunctionData('quoteExactInputSingle', [
              from.address,
              to.address,
              _amount.toString(),
              0, //sqrtPriceLimitX96
            ])
          : this.quoterIface.encodeFunctionData('quoteExactOutputSingle', [
              from.address,
              to.address,
              _amount.toString(),
              0, //sqrtPriceLimitX96
            ]),
    }));

    const data = await this.uniswapMulti.methods.multicall(calldata).call();

    let totalGasCost = 0;
    let totalSuccessFullSwaps = 0;
    const decode = (j: number): bigint => {
      const { success, gasUsed, returnData } = data.returnData[j];

      if (!success) {
        return 0n;
      }
      const decoded = defaultAbiCoder.decode(['uint256'], returnData);
      totalGasCost += +gasUsed;
      totalSuccessFullSwaps++;

      return BigInt(decoded[0].toString());
    };

    const averageGasCost = !totalSuccessFullSwaps
      ? ALGEBRA_QUOTE_GASLIMIT
      : Math.round(totalGasCost / totalSuccessFullSwaps);

    let i = 0;
    const _rates = _amounts.map(() => decode(i++));
    const unit: bigint = _rates[0];

    const prices = interpolate(
      _amounts.slice(1),
      _rates.slice(1),
      amounts,
      side,
    );

    return [
      {
        prices,
        unit,
        data: {
          path: [
            {
              tokenIn: from.address,
              tokenOut: to.address,
            },
          ],
        },
        poolIdentifier: this.getPoolIdentifier(pool.token0, pool.token1),
        exchange: this.dexKey,
        gasCost: prices.map(p => (p === 0n ? 0 : averageGasCost)),
        poolAddresses: [pool.poolAddress],
      },
    ];
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<AlgebraData>> {
    try {
      const _srcToken = this.dexHelper.config.wrapETH(srcToken);
      const _destToken = this.dexHelper.config.wrapETH(destToken);

      const [_srcAddress, _destAddress] = this._getLoweredAddresses(
        _srcToken,
        _destToken,
      );

      if (_srcAddress === _destAddress) return null;

      if (
        !limitPools?.includes(this.getPoolIdentifier(_srcAddress, _destAddress))
      )
        return null;

      const pool = await this.getPool(_srcAddress, _destAddress, blockNumber);

      if (!pool) return null;

      const state = pool.getState(blockNumber);

      if (state === null) {
        const rpcPrice = await this.getPricingFromRpc(
          _srcToken,
          _destToken,
          amounts,
          side,
          pool,
        );

        return rpcPrice;
      }

      const unitAmount = getBigIntPow(
        side == SwapSide.SELL ? _srcToken.decimals : _destToken.decimals,
      );

      const _amounts = [...amounts.slice(1)];

      const [token0] = this._sortTokens(_srcAddress, _destAddress);

      const zeroForOne = token0 === _srcAddress ? true : false;

      if (state.liquidity <= 0n) {
        this.logger.trace(`pool have 0 liquidity`);
        return null;
      }

      const balanceDestToken =
        _destAddress === pool.token0 ? state.balance0 : state.balance1;

      const unitResult = this._getOutputs(
        state,
        [unitAmount],
        zeroForOne,
        side,
        balanceDestToken,
      );
      const pricesResult = this._getOutputs(
        state,
        _amounts,
        zeroForOne,
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
              ALGEBRA_POOL_SEARCH_OVERHEAD +
              ALGEBRA_TICK_BASE_OVERHEAD +
              pricesResult.tickCounts[index] * ALGEBRA_TICK_GAS_COST
            );
          }
        }),
      ];

      return [
        {
          unit: unitResult.outputs[0],
          prices,
          data: {
            path: [
              {
                tokenIn: _srcAddress,
                tokenOut: _destAddress,
              },
            ],
          },
          poolIdentifier: this.getPoolIdentifier(pool.token0, pool.token1),
          exchange: this.dexKey,
          gasCost: gasCost,
          poolAddresses: [pool.poolAddress],
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

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AlgebraData,
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
        deadline: getLocalDeadlineAsFriendlyPlaceholder(), // FIXME: more gas efficient to pass block.timestamp in adapter
      },
    );

    return {
      targetExchange: this.config.router,
      payload,
      networkFee: '0',
    };
  }

  getCalldataGasCost(poolPrices: PoolPrices<AlgebraData>): number | number[] {
    const gasCost =
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> path header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> deadline
      CALLDATA_GAS_COST.TIMESTAMP +
      // ParentStruct -> path (20+3+20 = 43 = 32+11 bytes)
      CALLDATA_GAS_COST.LENGTH_SMALL +
      CALLDATA_GAS_COST.FULL_WORD +
      CALLDATA_GAS_COST.wordNonZeroBytes(11);
    const arr = new Array(poolPrices.prices.length);
    poolPrices.prices.forEach((p, index) => {
      if (p == 0n) {
        arr[index] = 0;
      } else {
        arr[index] = gasCost;
      }
    });
    return arr;
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AlgebraData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? UniswapV3Functions.exactInput
        : UniswapV3Functions.exactOutput;

    const path = this._encodePath(data.path, side);
    const swapFunctionParams: UniswapV3SimpleSwapParams =
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
        parseFloat(pool.totalValueLockedUSD) * ALGEBRA_EFFICIENCY_FACTOR,
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
        parseFloat(pool.totalValueLockedUSD) * ALGEBRA_EFFICIENCY_FACTOR,
    }));

    const pools = _.slice(
      _.sortBy(_.concat(pools0, pools1), [pool => -1 * pool.liquidityUSD]),
      0,
      limit,
    );
    return pools;
  }

  private _getLoweredAddresses(srcToken: Token, destToken: Token) {
    return [srcToken.address.toLowerCase(), destToken.address.toLowerCase()];
  }

  private _sortTokens(srcAddress: Address, destAddress: Address) {
    return [srcAddress, destAddress].sort((a, b) => (a < b ? -1 : 1));
  }

  private _toLowerForAllConfigAddresses() {
    // If new config property will be added, the TS will throw compile error
    const newConfig: DexParams = {
      router: this.config.router.toLowerCase(),
      quoter: this.config.quoter.toLowerCase(),
      factory: this.config.factory.toLowerCase(),
      algebraStateMulticall: this.config.algebraStateMulticall.toLowerCase(),
      chunksCount: this.config.chunksCount,
      uniswapMulticall: this.config.uniswapMulticall,
      deployer: this.config.deployer?.toLowerCase(),
      initHash: this.config.initHash,
      subgraphURL: this.config.subgraphURL,
    };
    return newConfig;
  }

  private _getOutputs(
    state: DeepReadonly<PoolState>,
    amounts: bigint[],
    zeroForOne: boolean,
    side: SwapSide,
    destTokenBalance: bigint,
  ): OutputResult | null {
    try {
      const outputsResult = AlgebraMath.queryOutputs(
        state,
        amounts,
        zeroForOne,
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

  private async _querySubgraph(
    query: string,
    variables: Object,
    timeout = 30000,
  ) {
    try {
      const res = await this.dexHelper.httpRequest.post(
        this.config.subgraphURL,
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

  private _encodePath(
    path: {
      tokenIn: Address;
      tokenOut: Address;
    }[],
    side: SwapSide,
  ): string {
    if (path.length === 0) {
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
            types: ['address', 'address'],
            _path: [curr.tokenIn, curr.tokenOut],
          };
        } else {
          return {
            types: [...types, 'address'],
            _path: [..._path, curr.tokenOut],
          };
        }
      },
      { _path: [], types: [] },
    );

    return side === SwapSide.BUY
      ? pack(types.reverse(), _path.reverse())
      : pack(types, _path);
  }

  releaseResources() {
    if (this.intervalTask !== undefined) {
      clearInterval(this.intervalTask);
      this.intervalTask = undefined;
    }
  }
}
