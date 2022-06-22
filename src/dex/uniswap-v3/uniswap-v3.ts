import { Interface } from '@ethersproject/abi';
import _ from 'lodash';
import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { getBigIntPow, getDexKeysWithNetwork, wrapETH } from '../../utils';
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
import { TickMath } from './contract-math/TickMath';

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
    super(dexHelper.augustusAddress, dexHelper.provider);
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
    console.log(0);
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

        this.dexHelper.blockManager.subscribeToLogs(
          pool,
          pool.addressesSubscribed,
          blockNumber,
        );
      } catch (e) {
        if (e instanceof Error && e.message.endsWith('Pool does not exist')) {
          // Pool does not exist for this feeCode, so we can set it to null
          // to prevent more requests for this pool
          pool = null;
          this.logger.warn(
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

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const _srcToken = wrapETH(srcToken, this.network);
    const _destToken = wrapETH(destToken, this.network);

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
    const _srcToken = wrapETH(srcToken, this.network);
    const _destToken = wrapETH(destToken, this.network);

    const [_srcAddress, _destAddress] = this._getLoweredAddresses(
      _srcToken,
      _destToken,
    );

    if (_srcAddress === _destAddress) return null;

    const selectedPools = await this._getPoolsFromIdentifiers(
      limitPools
        ? limitPools
        : await this.getPoolIdentifiers(
            _srcToken,
            _destToken,
            side,
            blockNumber,
          ),
      blockNumber,
    );

    if (selectedPools.length === 0) return null;

    const states = await Promise.all(
      selectedPools.map(async pool => {
        let state = pool.getState(blockNumber);
        if (state === null || !state.isValid) {
          state = await pool.generateState(blockNumber);
          pool.setState(state, blockNumber);
        }
        return state;
      }),
    );

    const unitAmount = getBigIntPow(
      side == SwapSide.SELL ? _srcToken.decimals : _destToken.decimals,
    );

    const _amounts = [unitAmount, ...amounts.slice(1)];

    const [token0] = this._sortTokens(_srcAddress, _destAddress);

    const zeroForOne = token0 === _srcAddress ? true : false;

    const result: ExchangePrices<UniswapV3Data> = new Array(
      selectedPools.length,
    );

    for (const [i, pool] of selectedPools.entries()) {
      const state = states[i];

      const prices =
        side == SwapSide.SELL
          ? this._getSellOutputs(state, _amounts, zeroForOne)
          : this._getBuyOutputs(state, _amounts, zeroForOne);

      if (!prices) return null;

      result[i] = {
        unit: prices[0],
        prices: [0n, ...prices.slice(1)],
        data: {
          fee: pool.feeCode.toString(),
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
    }
    return result;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { fee } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          fee: 'uint24',
          deadline: 'uint256',
          sqrtPriceLimitX96: 'uint160',
        },
      },
      {
        fee,
        deadline: this.getDeadline(),
        sqrtPriceLimitX96: 0,
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
        ? UniswapV3Functions.exactInputSingle
        : UniswapV3Functions.exactOutputSingle;

    const swapFunctionParams: UniswapV3Param =
      side === SwapSide.SELL
        ? {
            tokenIn: srcToken,
            tokenOut: destToken,
            fee: data.fee,
            recipient: this.augustusAddress,
            deadline: this.getDeadline(),
            amountIn: srcAmount,
            amountOutMinimum: destAmount,
            sqrtPriceLimitX96: '0',
          }
        : {
            tokenIn: srcToken,
            tokenOut: destToken,
            fee: data.fee,
            recipient: this.augustusAddress,
            deadline: this.getDeadline(),
            amountOut: destAmount,
            amountInMaximum: srcAmount,
            sqrtPriceLimitX96: '0',
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
    return pools.filter(pool => pool !== null) as UniswapV3EventPool[];
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

  private _getSellOutputs(
    state: DeepReadonly<PoolState>,
    amounts: bigint[],
    zeroForOne: boolean,
  ): bigint[] | null {
    let nulled = false;
    const outputs = amounts.map(amount => {
      try {
        const [amount0, amount1] = uniswapV3Math.querySwap(
          state,
          { ...state.ticks },
          zeroForOne,
          BigInt.asIntN(256, amount),
          zeroForOne
            ? TickMath.MIN_SQRT_RATIO + 1n
            : TickMath.MAX_SQRT_RATIO - 1n,
        );
        return BigInt.asUintN(256, -(zeroForOne ? amount1 : amount0));
      } catch (e) {
        this.logger.error(
          `${this.dexKey}: received error in _getSellOutputs while calculating outputs`,
          e,
        );
        nulled = true;
        return 0n;
      }
    });
    return nulled ? null : outputs;
  }

  private _getBuyOutputs(
    state: DeepReadonly<PoolState>,
    amounts: bigint[],
    zeroForOne: boolean,
  ): bigint[] | null {
    let nulled = false;
    const outputs = amounts.map(amount => {
      try {
        const [amount0Delta, amount1Delta] = uniswapV3Math.querySwap(
          state,
          { ...state.ticks },
          zeroForOne,
          -BigInt.asIntN(256, amount),
          zeroForOne
            ? TickMath.MIN_SQRT_RATIO + 1n
            : TickMath.MAX_SQRT_RATIO - 1n,
        );

        const amountIn = zeroForOne
          ? BigInt.asUintN(256, amount0Delta)
          : BigInt.asUintN(256, amount1Delta);
        return amountIn;
      } catch (e) {
        this.logger.error(
          `${this.dexKey}: received error in _getBuyOutputs while calculating outputs`,
          e,
        );
        nulled = true;
        return 0n;
      }
    });
    return nulled ? null : outputs;
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
}
