import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
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
import {
  DexParams,
  OutputResult,
  PoolState,
  QuoteExactInputSingleParams,
  QuoteExactOutputSingleParams,
  UniswapV3Data as SushiswapV3Data,
} from './types';
import {
  SimpleExchange,
  getLocalDeadlineAsFriendlyPlaceholder,
} from '../simple-exchange';
import { SushiswapV3Config, Adapters } from './config';
import { SushiswapV3EventPool } from './sushiswap-v3-pool';
import { Interface, defaultAbiCoder } from 'ethers/lib/utils';
import { AbiItem } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import { pack } from '@ethersproject/solidity';
import {
  UNISWAPV3_EFFICIENCY_FACTOR,
  UNISWAPV3_POOL_SEARCH_OVERHEAD,
  UNISWAPV3_TICK_BASE_OVERHEAD,
  UNISWAPV3_TICK_GAS_COST,
  ViemChain,
} from './constants';
import { uniswapV3Math } from '../uniswap-v3/contract-math/uniswap-v3-math';
import { BalanceRequest, getBalances } from '../../lib/tokens/balancer-fetcher';
import {
  AssetType,
  DEFAULT_ID_ERC20,
  DEFAULT_ID_ERC20_AS_STRING,
} from '../../lib/tokens/types';
import { DataFetcher, LiquidityProviders, Router } from '@sushiswap/router';
import { ChainId } from '@sushiswap/chain';
import { createPublicClient, http } from 'viem';

import SushiswapV3RouterABI from '../../abi/sushiswap-v3/RouterProcessor3.json';
import SushiswapV3QuoterV2ABI from '../../abi/sushiswap-v3/QuoterV2.json';
import UniswapV3MultiABI from '../../abi/uniswap-v3/UniswapMulti.abi.json';
import UniswapV3StateMulticallABI from '../../abi/uniswap-v3/UniswapV3StateMulticall.abi.json';
import { generateConfig } from '../../config';
import { BigNumber } from 'ethers';
import { getToken } from './token';
import _ from 'lodash';
import { UniswapV3Config } from '../uniswap-v3/config';

const UNISWAPV3_CLEAN_NOT_EXISTING_POOL_TTL_MS = 60 * 60 * 24 * 1000; // 24 hours
const UNISWAPV3_CLEAN_NOT_EXISTING_POOL_INTERVAL_MS = 30 * 60 * 1000; // Once in 30 minutes
const UNISWAPV3_QUOTE_GASLIMIT = 200_000;

export class SushiswapV3
  extends SimpleExchange
  implements IDex<SushiswapV3Data>
{
  readonly eventPools: Record<string, SushiswapV3EventPool | null> = {};

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  intervalTask?: NodeJS.Timeout;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SushiswapV3Config);

  logger: Logger;

  private uniswapMulti: Contract;
  private stateMultiContract: Contract;

  private notExistingPoolSetKey: string;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly routerIface = new Interface(SushiswapV3RouterABI),
    readonly quoterIface = new Interface(SushiswapV3QuoterV2ABI),
    readonly config = SushiswapV3Config[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey + '-' + network);

    this.uniswapMulti = new this.dexHelper.web3Provider.eth.Contract(
      UniswapV3MultiABI as AbiItem[],
      this.config.uniswapMulticall,
    );
    this.stateMultiContract = new this.dexHelper.web3Provider.eth.Contract(
      UniswapV3StateMulticallABI as AbiItem[],
      this.config.stateMulticall,
    );

    // To receive revert reasons
    this.dexHelper.web3Provider.eth.handleRevert = false;

    // Normalise once all config addresses and use across all scenarios
    this.config = this._toLowerForAllConfigAddresses();

    this.notExistingPoolSetKey =
      `${CACHE_PREFIX}_${network}_${dexKey}_not_existings_pool_set`.toLowerCase();
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    if (!this.dexHelper.config.isSlave) {
      const cleanExpiredNotExistingPoolsKeys = async () => {
        const maxTimestamp =
          Date.now() - UNISWAPV3_CLEAN_NOT_EXISTING_POOL_TTL_MS;
        await this.dexHelper.cache.zremrangebyscore(
          this.notExistingPoolSetKey,
          0,
          maxTimestamp,
        );
      };

      this.intervalTask = setInterval(
        cleanExpiredNotExistingPoolsKeys.bind(this),
        UNISWAPV3_CLEAN_NOT_EXISTING_POOL_INTERVAL_MS,
      );
    }
  }

  get supportedFees() {
    return this.config.supportedFees;
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPoolIdentifier(srcAddress: Address, destAddress: Address, fee: bigint) {
    const tokenAddresses = this._sortTokens(srcAddress, destAddress).join('_');
    return `${this.dexKey}_${tokenAddresses}_${fee}`;
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
  ): Promise<null | ExchangePrices<SushiswapV3Data>> {
    try {
      const _srcToken = this.dexHelper.config.wrapETH(srcToken);
      const _destToken = this.dexHelper.config.wrapETH(destToken);

      const [_srcAddress, _destAddress] = this._getLoweredAddresses(
        _srcToken,
        _destToken,
      );

      if (_srcAddress === _destAddress) return null;

      let selectedPools: SushiswapV3EventPool[] = [];

      if (!limitPools) {
        selectedPools = (
          await Promise.all(
            this.supportedFees.map(async fee => {
              const locallyFoundPool =
                this.eventPools[
                  this.getPoolIdentifier(_srcAddress, _destAddress, fee)
                ];
              if (locallyFoundPool) return locallyFoundPool;

              const newlyFetchedPool = await this.getPool(
                _srcAddress,
                _destAddress,
                fee,
                blockNumber,
              );
              return newlyFetchedPool;
            }),
          )
        ).filter(isTruthy);
      } else {
        const pairIdentifierWithoutFee = this.getPoolIdentifier(
          _srcAddress,
          _destAddress,
          0n,
          // Trim from 0 fee postfix, so it become comparable
        ).slice(0, -1);

        const poolIdentifiers = limitPools.filter(identifier =>
          identifier.startsWith(pairIdentifierWithoutFee),
        );

        selectedPools = (
          await Promise.all(
            poolIdentifiers.map(async identifier => {
              let locallyFoundPool = this.eventPools[identifier];
              if (locallyFoundPool) return locallyFoundPool;

              const [, srcAddress, destAddress, fee] = identifier.split('_');
              const newlyFetchedPool = await this.getPool(
                srcAddress,
                destAddress,
                BigInt(fee),
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
          poolWithState: [] as SushiswapV3EventPool[],
          poolWithoutState: [] as SushiswapV3EventPool[],
        },
      );

      const rpcResultsPromise = this.getPricingFromRpc(
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

      const zeroForOne = token0 === _srcAddress ? true : false;

      const result = await Promise.all(
        poolsToUse.poolWithState.map(async (pool, i) => {
          const state = states[i];

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
                  UNISWAPV3_POOL_SEARCH_OVERHEAD +
                  UNISWAPV3_TICK_BASE_OVERHEAD +
                  pricesResult.tickCounts[index] * UNISWAPV3_TICK_GAS_COST
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
                  fee: pool.feeCode.toString(),
                },
              ],
            },
            poolIdentifier: this.getPoolIdentifier(
              pool.token0,
              pool.token1,
              pool.feeCode,
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
      ) as ExchangePrices<SushiswapV3Data>;

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

  private getQuoterV2CallData(
    funcName: string,
    tokenIn: Address,
    tokenOut: Address,
    amount: bigint,
    fee: bigint,
  ): QuoteExactInputSingleParams | QuoteExactOutputSingleParams {
    return funcName === 'quoteExactInputSingle'
      ? { tokenIn, tokenOut, fee, sqrtPriceLimitX96: 0n, amountIn: amount }
      : { tokenIn, tokenOut, fee, sqrtPriceLimitX96: 0n, amount };
  }

  async getPricingFromRpc(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    pools: SushiswapV3EventPool[],
  ): Promise<ExchangePrices<SushiswapV3Data> | null> {
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

    const funcName =
      side === SwapSide.SELL
        ? 'quoteExactInputSingle'
        : 'quoteExactOutputSingle';

    const calldata = pools.map(pool =>
      _amounts.map(_amount => ({
        target: this.config.quoter,
        gasLimit: UNISWAPV3_QUOTE_GASLIMIT,
        callData: this.quoterIface.encodeFunctionData(funcName, [
          this.getQuoterV2CallData(
            funcName,
            from.address,
            to.address,
            _amount,
            pool.feeCode,
          ),
        ]),
      })),
    );

    const data = await new this.dexHelper.web3Provider.eth.Contract(
      UniswapV3MultiABI as AbiItem[],
      this.config.uniswapMulticall,
    ).methods
      .multicall(calldata.flat())
      .call();

    const decode = (j: number): bigint => {
      if (!data.returnData[j].success) {
        return 0n;
      }
      const decoded = defaultAbiCoder.decode(
        ['uint256'],
        data.returnData[j].returnData,
      );
      return BigInt(decoded[0].toString());
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

      return {
        prices,
        unit,
        data: {
          path: [
            {
              tokenIn: from.address,
              tokenOut: to.address,
              fee: pool.feeCodeAsString,
            },
          ],
        },
        poolIdentifier: this.getPoolIdentifier(
          pool.token0,
          pool.token1,
          pool.feeCode,
        ),
        exchange: this.dexKey,
        gasCost: prices.map(p => (p === 0n ? 0 : UNISWAPV3_QUOTE_GASLIMIT)),
        poolAddresses: [pool.poolAddress],
      };
    });

    return result;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<SushiswapV3Data>,
  ): number | number[] {
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

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SushiswapV3Data,
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
      targetExchange: UniswapV3Config['UniswapV3'][this.network].router,
      payload,
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
    data: SushiswapV3Data,
  ): Promise<SimpleExchangeParam> {
    const web3Client = createPublicClient({
      chain: ViemChain[this.network],
      transport: http(generateConfig(this.network).privateHttpProvider),
    });

    const dataFetcher = new DataFetcher(
      web3Client.chain.id as ChainId,
      web3Client,
    );

    dataFetcher.startDataFetching([LiquidityProviders.SushiSwapV3]);

    const fromToken = await getToken({ web3Client, address: srcToken });

    const toToken = await getToken({ web3Client, address: destToken });

    await dataFetcher.fetchPoolsForToken(fromToken, toToken);

    const pcMap = dataFetcher.getCurrentPoolCodeMap(fromToken, toToken);

    const route = Router.findBestRoute(
      pcMap,
      this.network as unknown as ChainId,
      fromToken,
      BigNumber.from(srcAmount),
      toToken,
      50e9,
      [LiquidityProviders.SushiSwapV3],
    );

    const rpParams = Router.routeProcessor2Params(
      pcMap,
      route,
      fromToken,
      toToken,
      this.augustusAddress,
      this.config.router,
    );

    const swapData = this.routerIface.encodeFunctionData('processRoute', [
      rpParams.tokenIn,
      rpParams.amountIn,
      rpParams.tokenOut,
      rpParams.amountOutMin,
      rpParams.to,
      rpParams.routeCode,
    ]);

    dataFetcher.stopDataFetching();

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
        parseFloat(pool.totalValueLockedUSD) * UNISWAPV3_EFFICIENCY_FACTOR,
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
        parseFloat(pool.totalValueLockedUSD) * UNISWAPV3_EFFICIENCY_FACTOR,
    }));

    const pools = _.slice(
      _.sortBy(_.concat(pools0, pools1), [pool => -1 * pool.liquidityUSD]),
      0,
      limit,
    );
    return pools;
  }

  private _encodePath(
    path: {
      tokenIn: Address;
      tokenOut: Address;
      fee: NumberAsString;
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
            _path: [curr.tokenIn, curr.fee, curr.tokenOut],
          };
        } else {
          return {
            types: [...types, 'uint24', 'address'],
            _path: [..._path, curr.fee, curr.tokenOut],
          };
        }
      },
      { _path: [], types: [] },
    );

    return side === SwapSide.BUY
      ? pack(types.reverse(), _path.reverse())
      : pack(types, _path);
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

    const pools = (
      await Promise.all(
        this.supportedFees.map(async fee =>
          this.getPool(_srcAddress, _destAddress, fee, blockNumber),
        ),
      )
    ).filter(pool => pool);

    if (pools.length === 0) return [];

    return pools.map(pool =>
      this.getPoolIdentifier(_srcAddress, _destAddress, pool!.feeCode),
    );
  }

  async getPool(
    srcAddress: Address,
    destAddress: Address,
    fee: bigint,
    blockNumber: number,
  ): Promise<SushiswapV3EventPool | null> {
    let pool =
      this.eventPools[this.getPoolIdentifier(srcAddress, destAddress, fee)];

    if (pool === undefined) {
      const [token0, token1] = this._sortTokens(srcAddress, destAddress);

      const key = `${token0}_${token1}_${fee}`.toLowerCase();

      const notExistingPoolScore = await this.dexHelper.cache.zscore(
        this.notExistingPoolSetKey,
        key,
      );

      const poolDoesNotExist = notExistingPoolScore !== null;

      if (poolDoesNotExist) {
        this.eventPools[this.getPoolIdentifier(srcAddress, destAddress, fee)] =
          null;
        return null;
      }

      await this.dexHelper.cache.hset(
        this.dexmapKey,
        key,
        JSON.stringify({
          token0,
          token1,
          fee: fee.toString(),
        }),
      );

      this.logger.trace(`starting to listen to new pool: ${key}`);
      pool = new SushiswapV3EventPool(
        this.dexHelper,
        this.dexKey,
        this.stateMultiContract,
        this.erc20Interface,
        this.config.factory,
        fee,
        token0,
        token1,
        this.logger,
        this.cacheStateKey,
        this.config.initHash,
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
        if (e instanceof Error && e.message.endsWith('Pool does not exist')) {
          // no need to await we want the set to have the pool key but it's not blocking
          this.dexHelper.cache.zadd(
            this.notExistingPoolSetKey,
            [Date.now(), key],
            'NX',
          );

          // Pool does not exist for this feeCode, so we can set it to null
          // to prevent more requests for this pool
          pool = null;
          this.logger.trace(
            `${this.dexHelper}: Pool: srcAddress=${srcAddress}, destAddress=${destAddress}, fee=${fee} not found`,
            e,
          );
        } else {
          // Unexpected Error. Break execution. Do not save the pool in this.eventPools
          this.logger.error(
            `${this.dexKey}: Can not generate pool state for srcAddress=${srcAddress}, destAddress=${destAddress}, fee=${fee} pool`,
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

      this.eventPools[this.getPoolIdentifier(srcAddress, destAddress, fee)] =
        pool;
    }
    return pool;
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
      supportedFees: this.config.supportedFees,
      stateMulticall: this.config.stateMulticall.toLowerCase(),
      chunksCount: this.config.chunksCount,
      uniswapMulticall: this.config.uniswapMulticall,
      deployer: this.config.deployer?.toLowerCase(),
      initHash: this.config.initHash,
      subgraphURL: this.config.subgraphURL,
    };
    return newConfig;
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

  private _getOutputs(
    state: DeepReadonly<PoolState>,
    amounts: bigint[],
    zeroForOne: boolean,
    side: SwapSide,
    destTokenBalance: bigint,
  ): OutputResult | null {
    try {
      const outputsResult = uniswapV3Math.queryOutputs(
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

  releaseResources(): AsyncOrSync<void> {
    if (this.intervalTask !== undefined) {
      clearInterval(this.intervalTask);
      this.intervalTask = undefined;
    }
  }
}
