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
const nervePoolABIDefault = require('../../abi/nerve/nerve-pool.json');
import { SwapSide, Network } from '../../constants';
import { wrapETH, getDexKeysWithNetwork } from '../../utils';
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
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { NerveConfig, Adapters } from './config';
import { NerveEventPool } from './nerve-pool';
import _ from 'lodash';
import { biginterify, ZERO } from './utils';

export class Nerve
  extends SimpleExchange
  implements IDex<PoolState, DexParams, OptimizedNerveData>
{
  protected eventPools: EventPoolMappings;

  readonly hasConstantPriceLargeAmounts = false;

  readonly minConversionRate = '1';

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(NerveConfig);

  logger: Logger;

  static getIdentifier(dexKey: string, tokenAddresses: string[]) {
    const processedTokens = tokenAddresses
      .sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1))
      .join('_');
    return `${dexKey}_${processedTokens}`;
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
    const allPoolKeys = Object.keys(Nerve.dexKeysWithNetwork);

    await Promise.all(
      allPoolKeys.map(poolKey => {
        const poolConfig = this.poolConfigs[poolKey];
        const poolIdentifier = Nerve.getIdentifier(
          this.dexKey,
          poolConfig.coins.map(token => token.address),
        );

        // We don't support Metapool yet
        if (!poolConfig.isMetapool) {
          this.eventPools[poolIdentifier] = new NerveEventPool(
            this.dexKey,
            this.network,
            this.dexHelper,
            this.logger,
            poolKey,
            poolConfig,
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
    pools?: NerveEventPool[],
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
          pool.tokenAddresses.includes(srcToken.address) &&
          pool.tokenAddresses.includes(destToken.address)
        );
      })
      .map(pool => Nerve.getIdentifier(this.dexKey, pool.tokenAddresses));
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

      const poolIdentifier = Nerve.getIdentifier(this.dexKey, [
        _srcToken.address,
        _destToken.address,
      ]);

      if (
        limitPools &&
        limitPools.every(p => p.toLowerCase() !== poolIdentifier)
      )
        return null;

      // await this.batchCatchUpPairs([[from, to]], blockNumber);

      // const pairParam = await this.getPairOrderedParams(from, to, blockNumber);

      // if (!pairParam) return null;

      // const unitAmount = BigInt(
      //   10 ** (side == SwapSide.BUY ? to.decimals : from.decimals),
      // );
      // const unit =
      //   side == SwapSide.BUY
      //     ? await this.getBuyPricePath(unitAmount, [pairParam])
      //     : await this.getSellPricePath(unitAmount, [pairParam]);

      // const prices =
      //   side == SwapSide.BUY
      //     ? await Promise.all(
      //         amounts.map(amount => this.getBuyPricePath(amount, [pairParam])),
      //       )
      //     : await Promise.all(
      //         amounts.map(amount => this.getSellPricePath(amount, [pairParam])),
      //       );

      // // As uniswapv2 just has one pool per token pair
      // return [
      //   {
      //     prices: prices,
      //     unit: unit,
      //     data: {
      //       router: this.router,
      //       path: [from.address.toLowerCase(), to.address.toLowerCase()],
      //       factory: this.factoryAddress,
      //       initCode: this.initCode,
      //       feeFactor: this.feeFactor,
      //       pools: [
      //         {
      //           address: pairParam.exchange,
      //           fee: parseInt(pairParam.fee),
      //           direction: pairParam.direction,
      //         },
      //       ],
      //     },
      //     exchange: this.dexKey,
      //     poolIdentifier,
      //     gasCost: this.poolGasCost,
      //     poolAddresses: [pairParam.exchange],
      //   },
      // ];
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

    const swapData = this.nervePoolIface.encodeFunctionData(
      NervePoolFunctions.swap,
      [i, j, srcAmount, this.minConversionRate, deadline],
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
    // Currently we don't need to wrap or unwrap tokens
    // as there are no pools with native tokens

    const selectedPools = this.allPools.filter(pool =>
      pool.tokenAddresses.includes(tokenAddress),
    );

    return Promise.all(
      // As the state is readonly we spread it to receive a copy,
      // It is not a deep copy, so we shouldn't alter the nested objects
      [...(await this.getStates(selectedPools))]
        .sort((a, b) => {
          const diff = b.state.lpToken_supply - a.state.lpToken_supply;
          if (diff === BigInt(0)) {
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
            ZERO,
          );

          let priceInUSD = 0;
          if (pool.poolConfig.isUSDPool) {
            // We force here precision to be 0
            priceInUSD = Number(
              totalLiquidity /
                biginterify(10) ** pool.math.POOL_PRECISION_DECIMALS,
            );
          } else {
            priceInUSD = this.dexHelper.getTokenUSDPrice(
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
                  token.address.toLowerCase() !== tokenAddress.toLowerCase(),
              )
              .value(),
            liquidityUSD: priceInUSD,
          };
        }),
    );
  }
}
