import { Interface } from '@ethersproject/abi';
import _ from 'lodash';
import { pack } from '@ethersproject/solidity';
import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  NumberAsString,
} from '../../types';
import { SwapSide, Network, CACHE_PREFIX } from '../../constants';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  DexParams,
  PoolState,
  UniswapV3Data,
  UniswapV3Functions,
  UniswapV3Param,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { UniswapV3Config, Adapters, PoolsToPreload } from './config';
import { UniswapV3EventPool } from './uniswap-v3-pool';
import UniswapV3RouterABI from '../../abi/uniswap-v3/UniswapV3Router.abi.json';
import {
  UNISWAPV3_EFFICIENCY_FACTOR,
  UNISWAPV3_QUOTE_GASLIMIT,
  UNISWAPV3_SUBGRAPH_URL,
} from './constants';
import { DeepReadonly } from 'ts-essentials';
import { uniswapV3Math } from './contract-math/uniswap-v3-math';

type PoolPairsInfo = {
  token0: Address;
  token1: Address;
};

export class UniswapV3
  extends SimpleExchange
  implements IDex<UniswapV3Data, UniswapV3Param>
{
  readonly eventPools: Record<string, UniswapV3EventPool | null> = {};

  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UniswapV3Config);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly routerIface = new Interface(UniswapV3RouterABI),
    protected config = UniswapV3Config[dexKey][network],
    protected poolsToPreload = PoolsToPreload[dexKey][network] || [],
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);

    // To receive revert reasons
    this.dexHelper.web3Provider.eth.handleRevert = false;

    // Normalise once all config addresses and use across all scenarios
    this.config = this._toLowerForAllConfigAddresses();
  }

  get supportedFees() {
    return this.config.supportedFees;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPoolIdentifier(srcAddress: Address, destAddress: Address, fee: bigint) {
    const tokenAddresses = this._sortTokens(srcAddress, destAddress).join('_');
    return `${this.dexKey}_${tokenAddresses}_${fee}`;
  }

  async initializePricing(blockNumber: number) {
    // This is only for testing, because cold pool fetching is goes out of
    // FETCH_POOL_INDENTIFIER_TIMEOUT range
    await Promise.all(
      this.poolsToPreload.map(async pool =>
        Promise.all(
          this.config.supportedFees.map(async fee =>
            this.getPool(pool.token0, pool.token1, fee, blockNumber),
          ),
        ),
      ),
    );
  }

  async getPool(
    srcAddress: Address,
    destAddress: Address,
    fee: bigint,
    blockNumber: number,
  ): Promise<UniswapV3EventPool | null> {
    let pool =
      this.eventPools[this.getPoolIdentifier(srcAddress, destAddress, fee)];
    if (pool === undefined) {
      const [token0, token1] = this._sortTokens(srcAddress, destAddress);

      const key =
        `${CACHE_PREFIX}_${this.dexKey}_poolconfig_${token0}_${token1}`.toLowerCase();

      await this.dexHelper.cache.rawsetex(
        key,
        JSON.stringify({
          token0,
          token1,
        }),
      );

      pool = new UniswapV3EventPool(
        this.dexKey,
        this.network,
        this.dexHelper,
        this.logger,
        this.config.stateMulticall,
        this.config.factory,
        fee,
        token0,
        token1,
      );

      let newState;
      try {
        newState = await pool.generateState(blockNumber);

        pool.setState(newState, blockNumber);

        pool.initialize(blockNumber);
      } catch (e) {
        if (e instanceof Error && e.message.endsWith('Pool does not exist')) {
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
          return null;
        }
      }

      this.eventPools[this.getPoolIdentifier(srcAddress, destAddress, fee)] =
        pool;
    }
    return pool;
  }

  async addMasterPool(poolKey: string) {
    const key =
      `${CACHE_PREFIX}_${this.dexKey}_poolconfig_${poolKey}`.toLowerCase();
    const _pairs = await this.dexHelper.cache.rawget(key);
    if (!_pairs) {
      this.logger.warn(`did not find poolconfig in for key ${key}`);
      return;
    }

    this.logger.info(`starting to listen to new pool: ${key}`);
    const pairs: PoolPairsInfo = JSON.parse(_pairs);

    await Promise.all(
      this.supportedFees.map(async fee => {
        this.getPool(
          pairs.token0,
          pairs.token1,
          fee,
          this.dexHelper.blockManager.getLatestBlockNumber(),
        );
      }),
    );
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

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<UniswapV3Data>> {
    try {
      const _srcToken = this.dexHelper.config.wrapETH(srcToken);
      const _destToken = this.dexHelper.config.wrapETH(destToken);

      const [_srcAddress, _destAddress] = this._getLoweredAddresses(
        _srcToken,
        _destToken,
      );

      if (_srcAddress === _destAddress) return null;

      let selectedPools: UniswapV3EventPool[] = [];
      if (limitPools === undefined) {
        selectedPools = (
          await Promise.all(
            this.supportedFees.map(async fee =>
              this.getPool(_srcAddress, _destAddress, fee, blockNumber),
            ),
          )
        ).filter(pool => pool) as UniswapV3EventPool[];
      } else {
        const pairIdentifierWithoutFee = this.getPoolIdentifier(
          _srcAddress,
          _destAddress,
          0n,
          // Trim from 0 fee postfix, so it become comparable
        ).slice(0, -1);
        selectedPools = await this._getPoolsFromIdentifiers(
          limitPools.filter(identifier =>
            identifier.startsWith(pairIdentifierWithoutFee),
          ),
          blockNumber,
        );
      }

      if (selectedPools.length === 0) return null;

      const states = await Promise.all(
        selectedPools.map(async pool => {
          let state = pool.getState(blockNumber);
          if (state === null || !state.isValid) {
            if (state === null) {
              this.logger.trace(
                `${this.dexKey}: State === null. Generating new one`,
              );
            } else if (!state.isValid) {
              this.logger.trace(
                `${this.dexKey}: State is invalid. Generating new one`,
              );
            }

            state = await pool.generateState(blockNumber);
            pool.setState(state, blockNumber);
          }
          return state;
        }),
      );

      const unitAmount = getBigIntPow(
        side == SwapSide.SELL ? _srcToken.decimals : _destToken.decimals,
      );

      const _amounts = [...amounts.slice(1)];

      const [token0] = this._sortTokens(_srcAddress, _destAddress);

      const zeroForOne = token0 === _srcAddress ? true : false;

      const result = await Promise.all(
        selectedPools.map(async (pool, i) => {
          const state = states[i];

          const [unit, prices] = await Promise.all([
            this._getOutputs(state, [unitAmount], zeroForOne, side),
            this._getOutputs(state, _amounts, zeroForOne, side),
          ]);

          if (!prices || !unit) {
            throw new Error('Prices or unit is not calculated');
          }

          return {
            unit: unit[0],
            prices: [0n, ...prices],
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
            gasCost: UNISWAPV3_QUOTE_GASLIMIT,
            poolAddresses: [pool.poolAddress],
          };
        }),
      );
      return result;
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
    data: UniswapV3Data,
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
        deadline: this.getDeadline(),
      },
    );

    return {
      targetExchange: this.config.router,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV3Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? UniswapV3Functions.exactInput
        : UniswapV3Functions.exactOutput;

    const path = this._encodePath(data.path, side);
    const swapFunctionParams: UniswapV3Param =
      side === SwapSide.SELL
        ? {
            recipient: this.augustusAddress,
            deadline: this.getDeadline(),
            amountIn: srcAmount,
            amountOutMinimum: destAmount,
            path,
          }
        : {
            recipient: this.augustusAddress,
            deadline: this.getDeadline(),
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

  private async _getPoolsFromIdentifiers(
    poolIdentifiers: string[],
    blockNumber: number,
  ): Promise<UniswapV3EventPool[]> {
    const pools = await Promise.all(
      poolIdentifiers.map(async identifier => {
        const [, srcAddress, destAddress, fee] = identifier.split('_');
        return this.getPool(srcAddress, destAddress, BigInt(fee), blockNumber);
      }),
    );
    return pools.filter(pool => pool) as UniswapV3EventPool[];
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
      factory: this.config.factory.toLowerCase(),
      supportedFees: this.config.supportedFees,
      stateMulticall: this.config.stateMulticall.toLowerCase(),
    };
    return newConfig;
  }

  private async _getOutputs(
    state: DeepReadonly<PoolState>,
    amounts: bigint[],
    zeroForOne: boolean,
    side: SwapSide,
  ): Promise<bigint[] | null> {
    try {
      const outputs = await uniswapV3Math.queryOutputs(
        state,
        amounts,
        zeroForOne,
        side,
      );
      return outputs;
    } catch (e) {
      this.logger.error(
        `${this.dexKey}: received error in _getSellOutputs while calculating outputs`,
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
        UNISWAPV3_SUBGRAPH_URL,
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
}
