import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import nervePoolABIDefault from '../../abi/nerve/nerve-pool.json';
import { SwapSide, Network } from '../../constants';
import { wrapETH, getDexKeysWithNetwork, interpolate, getBigIntPow } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  NerveData,
  PoolState,
  DexParams,
  EventPoolMappings,
  OptimizedNerveData,
  NervePoolFunctions,
  EventPoolOrMetapool,
  NervePoolSwapParams,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { NerveConfig, Adapters, NERVE_GAS_COST, NERVE_CHUNKS } from './config';
import { NerveEventPool } from './nerve-pool';
import _ from 'lodash';
import { biginterify } from './utils';

export class Nerve
  extends SimpleExchange
  implements IDex<NerveData, DexParams, OptimizedNerveData>
{
  protected eventPools: EventPoolMappings = {};

  readonly hasConstantPriceLargeAmounts = false;

  readonly minConversionRate = '1';

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(NerveConfig);

  logger: Logger;

  static getIdentifier(dexKey: string, poolAddress: string) {
    return `${dexKey.toLowerCase()}_${poolAddress.toLowerCase()}`;
  }

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected poolConfigs = NerveConfig[dexKey][network].poolConfigs,
    protected nervePoolIface = new Interface(nervePoolABIDefault),
  ) {
    super(dexHelper.augustusAddress, dexHelper.provider);
    this.logger = dexHelper.getLogger(dexKey);
  }

  get allPools() {
    return Object.values(this.eventPools);
  }

  async initializePricing(blockNumber: number) {
    await Promise.all(
      Object.values(this.poolConfigs).map(poolConfig => {
        const poolIdentifier = Nerve.getIdentifier(
          this.dexKey,
          poolConfig.address,
        );

        // We don't support Metapool yet
        if (!poolConfig.isMetapool) {
          this.eventPools[poolIdentifier] = new NerveEventPool(
            this.dexKey,
            this.network,
            this.dexHelper,
            this.logger,
            poolConfig.name,
          );
          // Generate first state for the blockNumber
          return this.eventPools[poolIdentifier].setup(blockNumber);
        }
      }),
    );
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] || null;
  }

  async getStates(
    pools?: EventPoolOrMetapool[],
    blockNumber?: number,
  ): Promise<DeepReadonly<{ state: PoolState; pool: EventPoolOrMetapool }[]>> {
    const _pools = pools === undefined ? this.allPools : pools;

    const _blockNumber =
      blockNumber === undefined
        ? await this.dexHelper.provider.getBlockNumber()
        : blockNumber;

    return Promise.all(
      _pools.map(async eventPool => {
        let state = eventPool.getState(_blockNumber);
        if (!state || !state.isValid) {
          this.logger.info(
            `State for ${this.dexKey} pool ${eventPool.name} is stale or invalid on block ${_blockNumber}. Generating new one`,
          );
          const newState = await eventPool.generateState(_blockNumber);
          eventPool.setState(newState, _blockNumber);
          return { state: newState, pool: eventPool };
        } else {
          return { state, pool: eventPool };
        }
      }),
    );
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    return this.allPools
      .filter(pool => {
        return (
          pool.tokenAddresses.includes(srcToken.address.toLowerCase()) &&
          pool.tokenAddresses.includes(destToken.address.toLowerCase())
        );
      })
      .map(pool => Nerve.getIdentifier(this.dexKey, pool.address));
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<NerveData>> {
    try {
      if (side === SwapSide.BUY) return null;

      const _srcToken = wrapETH(srcToken, this.network);
      const _destToken = wrapETH(destToken, this.network);

      if (
        _srcToken.address.toLowerCase() === _destToken.address.toLowerCase()
      ) {
        return null;
      }

      const filterPoolsByIdentifiers = (
        identifiers: string[],
        pools: EventPoolOrMetapool[],
      ) => {
        return pools.filter(pool =>
          identifiers.includes(Nerve.getIdentifier(this.dexKey, pool.address)),
        );
      };

      const selectedPools = !limitPools
        ? filterPoolsByIdentifiers(
            await this.getPoolIdentifiers(
              _srcToken,
              _destToken,
              side,
              blockNumber,
            ),
            this.allPools,
          )
        : filterPoolsByIdentifiers(limitPools, this.allPools);

      const statePoolPair = await this.getStates(selectedPools, blockNumber);

      // here side === SwapSide.SELL
      const unitVolume = getBigIntPow(10 ** _srcToken.decimals);
      const chunks = amounts.length - 1;

      const _width = Math.floor(chunks / NERVE_CHUNKS);
      const _amounts = [unitVolume].concat(
        Array.from(Array(NERVE_CHUNKS).keys()).map(
          i => amounts[(i + 1) * _width],
        ),
      );

      const result: ExchangePrices<NerveData> = [];
      for (const { pool, state } of statePoolPair) {
        // To be able to update state property isValid if calculations receive error
        const _state = _.cloneDeep(state) as PoolState;

        const srcIndex = pool.tokens.findIndex(
          token =>
            token.address.toLowerCase() === _srcToken.address.toLowerCase(),
        );
        const destIndex = pool.tokens.findIndex(
          token =>
            token.address.toLowerCase() === _destToken.address.toLowerCase(),
        );

        const _rates: bigint[] = [];
        for (const _amount of _amounts) {
          const out = pool.math.calculateSwap(
            _state,
            srcIndex,
            destIndex,
            _amount,
            // Actually we need here block timestamp, but +- 15 seconds shouldn't
            // affect the calculations
            biginterify((Date.now() / 1000).toFixed(0)),
          );
          if (out === null) {
            // Something unexpected happen, so set invalidated state.
            // Later it will regenerated
            pool.setState(_state, blockNumber);
            this.logger.error(
              `${this.dexKey} protocol ${pool.name} (${pool.address}) pool can not calculate out swap for amount ${_amount}`,
            );
            return null;
          }
          _rates.push(out.dy);
        }

        const unit = _rates[0];
        const prices = interpolate(
          _amounts.slice(1),
          _rates.slice(1),
          amounts,
          side,
        );

        result.push({
          prices,
          unit,
          data: {
            i: srcIndex.toString(),
            j: destIndex.toString(),
            exchange: pool.address,
            deadline: (Math.floor(Date.now() / 1000) + 10 * 60).toString(),
          },
          poolIdentifier: Nerve.getIdentifier(this.dexKey, pool.address),
          exchange: this.dexKey,
          gasCost: NERVE_GAS_COST,
          poolAddresses: [pool.address],
        });
      }
      return result;
    } catch (e) {
      if (blockNumber === 0)
        this.logger.error(
          `Error_getPricesVolume: Aurelius block manager not yet instantiated`,
        );
      this.logger.error(`Error_getPrices:`, e);
      return null;
    }
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedNerveData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { i, j, deadline } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          i: 'int128',
          j: 'int128',
          deadline: 'uint256',
        },
      },
      { i, j, deadline },
    );
    return {
      targetExchange: data.exchange,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OptimizedNerveData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { exchange, i, j, deadline } = data;

    const swapFunctionParam: NervePoolSwapParams = [
      i,
      j,
      srcAmount,
      this.minConversionRate,
      deadline,
    ];

    const swapData = this.nervePoolIface.encodeFunctionData(
      NervePoolFunctions.swap,
      swapFunctionParam,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    // We set decimals to default as we don't really care of actual number.
    // We use here only address
    const wrappedTokenAddress = wrapETH(
      { address: tokenAddress, decimals: 18 },
      this.network,
    );

    const selectedPools = this.allPools.filter(pool =>
      pool.tokenAddresses.includes(wrappedTokenAddress.address),
    );

    return Promise.all(
      // As the state is readonly we spread it to receive a copy,
      // It is not a deep copy, so we shouldn't alter the nested objects
      [...(await this.getStates(selectedPools))]
        .sort((a, b) => {
          const diff = b.state.lpToken_supply - a.state.lpToken_supply;
          if (diff === 0n) {
            return 0;
          } else if (diff.toString().startsWith('-')) {
            return -1;
          } else {
            return 1;
          }
        })
        .slice(0, limit)
        .map(async ({ state, pool }) => {
          const normalisedBalances = pool.math._xp(state);
          const totalLiquidity = normalisedBalances.reduce(
            (prev, acc, i) => prev + acc,
            0n,
          );

          let priceInUSD = 0;
          if (pool.poolConfig.isUSDPool) {
            // We force here precision to be 0
            priceInUSD = Number(
              totalLiquidity /
                biginterify(10) ** pool.math.POOL_PRECISION_DECIMALS,
            );
          } else {
            priceInUSD = await this.dexHelper.getTokenUSDPrice(
              {
                // I assume that the first indexed token is the most popular
                address: pool.tokens[0].address,
                decimals: Number(pool.math.POOL_PRECISION_DECIMALS),
              },
              totalLiquidity,
            );
          }

          return {
            exchange: pool.name,
            address: pool.address,
            connectorTokens: _(pool.tokens)
              .uniqBy('address')
              .filter(
                token =>
                  token.address.toLowerCase() !==
                  wrappedTokenAddress.address.toLowerCase(),
              )
              .value(),
            liquidityUSD: priceInUSD,
          };
        }),
    );
  }
}
