import EventEmitter from 'events';
import { CacheEvents, TypedEventEmitter } from './types';
import {
  fromPairKey,
  toDirectionKey,
  toPairKey,
  isOrderTradable,
} from './utils';
import {
  BlockMetadata,
  EncodedOrder,
  EncodedStrategy,
  OrdersMap,
  RetypeBigNumberToString,
  TokenPair,
  TradeData,
} from '../common/types';
import { BigNumberish, BigNumber } from '../utils/numerics';
import {
  encodedOrderBNToStr,
  encodedStrategyBNToStr,
  encodedOrderStrToBN,
  encodedStrategyStrToBN,
} from '../utils/serializers';
import { Logger } from '../common/logger';
const logger = new Logger('ChainCache.ts');

const schemeVersion = 6; // bump this when the serialization format changes

type PairToStrategiesMap = { [key: string]: EncodedStrategy[] };
type StrategyById = { [key: string]: EncodedStrategy };
type PairToDirectedOrdersMap = { [key: string]: OrdersMap };

type SerializableDump = {
  schemeVersion: number;
  strategiesByPair: RetypeBigNumberToString<PairToStrategiesMap>;
  strategiesById: RetypeBigNumberToString<StrategyById>;
  ordersByDirectedPair: RetypeBigNumberToString<PairToDirectedOrdersMap>;
  tradingFeePPMByPair: { [key: string]: number };
  latestBlockNumber: number;
  latestTradesByPair: { [key: string]: TradeData };
  latestTradesByDirectedPair: { [key: string]: TradeData };
  blocksMetadata: BlockMetadata[];
};

export class ChainCache extends (EventEmitter as new () => TypedEventEmitter<CacheEvents>) {
  //#region private members
  private _strategiesByPair: PairToStrategiesMap = {};
  private _strategiesById: StrategyById = {};
  private _ordersByDirectedPair: PairToDirectedOrdersMap = {};
  private _latestBlockNumber: number = 0;
  private _latestTradesByPair: { [key: string]: TradeData } = {};
  private _latestTradesByDirectedPair: { [key: string]: TradeData } = {};
  private _blocksMetadata: BlockMetadata[] = [];
  private _tradingFeePPMByPair: { [key: string]: number } = {};

  private _handleCacheMiss:
    | ((token0: string, token1: string) => Promise<void>)
    | undefined;
  //#endregion private members

  //#region serialization for persistent caching
  public static fromSerialized(serializedCache: string): ChainCache {
    try {
      const cache = new ChainCache();
      cache._deserialize(serializedCache);
      return cache;
    } catch (e) {
      logger.error('Failed to deserialize cache, returning clear cache', e);
    }
    return new ChainCache();
  }

  private _deserialize(serializedCache: string): void {
    const parsedCache = JSON.parse(serializedCache) as SerializableDump;
    const { schemeVersion: version } = parsedCache;
    if (version !== schemeVersion) {
      logger.log(
        'Cache version mismatch, ignoring cache. Expected',
        schemeVersion,
        'got',
        version,
        'This may be due to a breaking change in the cache format since it was last persisted.',
      );
      return;
    }

    this._strategiesByPair = Object.entries(
      parsedCache.strategiesByPair,
    ).reduce((acc, [key, strategies]) => {
      acc[key] = strategies.map(encodedStrategyStrToBN);
      return acc;
    }, {} as PairToStrategiesMap);

    this._strategiesById = Object.entries(parsedCache.strategiesById).reduce(
      (acc, [key, strategy]) => {
        acc[key] = encodedStrategyStrToBN(strategy);
        return acc;
      },
      {} as StrategyById,
    );

    this._ordersByDirectedPair = Object.entries(
      parsedCache.ordersByDirectedPair,
    ).reduce((acc, [directedPairKey, orderMap]) => {
      acc[directedPairKey] = Object.entries(orderMap).reduce(
        (acc, [strategyId, order]) => {
          acc[strategyId] = encodedOrderStrToBN(order);
          return acc;
        },
        {} as OrdersMap,
      );
      return acc;
    }, {} as PairToDirectedOrdersMap);

    this._tradingFeePPMByPair = parsedCache.tradingFeePPMByPair;
    this._latestBlockNumber = parsedCache.latestBlockNumber;
    this._latestTradesByPair = parsedCache.latestTradesByPair;
    this._latestTradesByDirectedPair = parsedCache.latestTradesByDirectedPair;
    this._blocksMetadata = parsedCache.blocksMetadata;
  }

  public serialize(): string {
    const dump: SerializableDump = {
      schemeVersion,
      strategiesByPair: Object.entries(this._strategiesByPair).reduce(
        (acc, [key, strategies]) => {
          acc[key] = strategies.map(encodedStrategyBNToStr);
          return acc;
        },
        {} as RetypeBigNumberToString<PairToStrategiesMap>,
      ),
      strategiesById: Object.entries(this._strategiesById).reduce(
        (acc, [key, strategy]) => {
          acc[key] = encodedStrategyBNToStr(strategy);
          return acc;
        },
        {} as RetypeBigNumberToString<StrategyById>,
      ),
      ordersByDirectedPair: Object.entries(this._ordersByDirectedPair).reduce(
        (acc, [directedPairKey, orderMap]) => {
          acc[directedPairKey] = Object.entries(orderMap).reduce(
            (acc, [strategyId, order]) => {
              acc[strategyId] = encodedOrderBNToStr(order);
              return acc;
            },
            {} as RetypeBigNumberToString<OrdersMap>,
          );
          return acc;
        },
        {} as RetypeBigNumberToString<PairToDirectedOrdersMap>,
      ),
      tradingFeePPMByPair: this._tradingFeePPMByPair,
      latestBlockNumber: this._latestBlockNumber,
      latestTradesByPair: this._latestTradesByPair,
      latestTradesByDirectedPair: this._latestTradesByDirectedPair,
      blocksMetadata: this._blocksMetadata,
    };
    return JSON.stringify(dump);
  }
  //#endregion serialization for persistent caching

  public setCacheMissHandler(
    handler: (token0: string, token1: string) => Promise<void>,
  ): void {
    this._handleCacheMiss = handler;
  }

  private async _checkAndHandleCacheMiss(token0: string, token1: string) {
    if (!this._handleCacheMiss || this.hasCachedPair(token0, token1)) return;

    logger.debug('Cache miss for pair', token0, token1);
    await this._handleCacheMiss(token0, token1);
    logger.debug('Cache miss for pair', token0, token1, 'resolved');
  }

  public clear(): void {
    const pairs = Object.keys(this._strategiesByPair).map(fromPairKey);
    this._strategiesByPair = {};
    this._strategiesById = {};
    this._ordersByDirectedPair = {};
    this._latestBlockNumber = 0;
    this._latestTradesByPair = {};
    this._latestTradesByDirectedPair = {};
    this._blocksMetadata = [];
    this.emit('onPairDataChanged', pairs);
  }

  //#region public getters

  public async getStrategiesByPair(
    token0: string,
    token1: string,
  ): Promise<EncodedStrategy[] | undefined> {
    await this._checkAndHandleCacheMiss(token0, token1);
    const key = toPairKey(token0, token1);
    return this._strategiesByPair[key];
  }

  public getStrategyById(id: BigNumberish): EncodedStrategy | undefined {
    return this._strategiesById[id.toString()];
  }

  public getCachedPairs(onlyWithStrategies: boolean = true): TokenPair[] {
    if (onlyWithStrategies) {
      return Object.entries(this._strategiesByPair)
        .filter(([_, strategies]) => strategies.length > 0)
        .map(([key, _]) => fromPairKey(key));
    }

    return Object.keys(this._strategiesByPair).map(fromPairKey);
  }

  /**
   * returns the orders that sell targetToken for sourceToken
   */
  public async getOrdersByPair(
    sourceToken: string,
    targetToken: string,
    keepNonTradable: boolean = false,
  ): Promise<OrdersMap> {
    await this._checkAndHandleCacheMiss(sourceToken, targetToken);
    const key = toDirectionKey(sourceToken, targetToken);
    const orders = this._ordersByDirectedPair[key] || {};

    if (keepNonTradable) return orders;

    return Object.fromEntries(
      Object.entries(orders).filter(([_, order]) => isOrderTradable(order)),
    );
  }

  public hasCachedPair(token0: string, token1: string): boolean {
    const key = toPairKey(token0, token1);
    return !!this._strategiesByPair[key];
  }

  public async getLatestTradeByPair(
    token0: string,
    token1: string,
  ): Promise<TradeData | undefined> {
    await this._checkAndHandleCacheMiss(token0, token1);
    const key = toPairKey(token0, token1);
    return this._latestTradesByPair[key];
  }

  public async getLatestTradeByDirectedPair(
    sourceToken: string,
    targetToken: string,
  ): Promise<TradeData | undefined> {
    await this._checkAndHandleCacheMiss(sourceToken, targetToken);
    const key = toDirectionKey(sourceToken, targetToken);
    return this._latestTradesByDirectedPair[key];
  }

  public getLatestTrades(): TradeData[] {
    return Object.values(this._latestTradesByPair);
  }

  public getLatestBlockNumber(): number {
    return this._latestBlockNumber;
  }

  public async getTradingFeePPMByPair(
    token0: string,
    token1: string,
  ): Promise<number | undefined> {
    await this._checkAndHandleCacheMiss(token0, token1);
    const key = toPairKey(token0, token1);
    return this._tradingFeePPMByPair[key];
  }

  public get blocksMetadata(): BlockMetadata[] {
    return this._blocksMetadata;
  }

  public set blocksMetadata(blocks: BlockMetadata[]) {
    this._blocksMetadata = blocks;
  }
  //#endregion public getters

  //#region cache updates
  /**
   * This method is to be used when all the existing strategies of a pair are
   * fetched and are to be stored in the cache.
   * Once a pair is cached, the only way to update it is by using `applyBatchedUpdates`.
   * If all the strategies of a pair are deleted, the pair remains in the cache and there's
   * no need to add it again.
   * @param {string} token0 - address of the first token of the pair
   * @param {string} token1 - address of the second token of the pair
   * @param {EncodedStrategy[]} strategies - the strategies to be cached
   * @throws {Error} if the pair is already cached
   * @returns {void}
   */
  public addPair(
    token0: string,
    token1: string,
    strategies: EncodedStrategy[],
    noPairAddedEvent: boolean = false,
  ): void {
    logger.debug(
      'Adding pair with',
      strategies.length,
      ' strategies to cache',
      token0,
      token1,
    );
    const key = toPairKey(token0, token1);
    if (this._strategiesByPair[key]) {
      throw new Error(`Pair ${key} already cached`);
    }
    this._strategiesByPair[key] = strategies;
    strategies.forEach(strategy => {
      this._strategiesById[strategy.id.toString()] = strategy;
      this._addStrategyOrders(strategy);
    });
    if (!noPairAddedEvent) {
      logger.debug('Emitting onPairAddedToCache', token0, token1);
      this.emit('onPairAddedToCache', fromPairKey(key));
    }
  }

  /**
   * This methods allows setting the trading fee of a pair.
   * Note that fees can also be updated via `applyBatchedUpdates`.
   * This specific method is useful when the fees were fetched from the chain
   * as part of initialization or some other operation mode which doesn't
   * rely on even processing
   *
   * @param {string} token0 - address of the first token of the pair
   * @param {string} token1 - address of the second token of the pair
   * @param tradingFeePPM - the pair's trading fee
   */
  public addPairFees(
    token0: string,
    token1: string,
    tradingFeePPM: number,
  ): void {
    logger.debug(
      'Adding trading fee to pair',
      token0,
      token1,
      'fee',
      tradingFeePPM,
    );
    const key = toPairKey(token0, token1);
    this._tradingFeePPMByPair[key] = tradingFeePPM;
  }

  /**
   * This method is to be used when events from a range of blocks are fetched
   * and are to be applied to the cache.
   * All the events should belong to pairs that are already cached.
   * The way to use this work flow is to first call `getLatestBlockNumber` to
   * get the latest block number that was already cached, then fetch all the
   * events from that block number to the latest block number, and finally
   * call this method with the fetched events.
   * Note: the cache can handle a case of a strategy that was created and then updated and then deleted
   * @param {number} latestBlockNumber - the latest block number that was fetched
   * @param {TradeData[]} latestTrades - the trades that were conducted
   * @param {EncodedStrategy[]} createdStrategies - the strategies that were created
   * @param {EncodedStrategy[]} updatedStrategies - the strategies that were updated
   * @param {EncodedStrategy[]} deletedStrategies - the strategies that were deleted
   * @throws {Error} if the pair of a strategy is not cached
   * @returns {void}
   */
  public applyBatchedUpdates(
    latestBlockNumber: number,
    latestFeeUpdates: [string, string, number][],
    latestTrades: TradeData[],
    createdStrategies: EncodedStrategy[],
    updatedStrategies: EncodedStrategy[],
    deletedStrategies: EncodedStrategy[],
  ): void {
    logger.debug('Applying batched updates to cache', {
      latestBlockNumber,
      latestFeeUpdates,
      latestTrades,
      createdStrategies,
      updatedStrategies,
      deletedStrategies,
    });
    const affectedPairs = new Set<string>();
    latestTrades.forEach(trade => {
      this._setLatestTrade(trade);
      affectedPairs.add(toPairKey(trade.sourceToken, trade.targetToken));
    });
    createdStrategies.forEach(strategy => {
      this._addStrategy(strategy);
      affectedPairs.add(toPairKey(strategy.token0, strategy.token1));
    });
    updatedStrategies.forEach(strategy => {
      this._updateStrategy(strategy);
      affectedPairs.add(toPairKey(strategy.token0, strategy.token1));
    });
    deletedStrategies.forEach(strategy => {
      this._deleteStrategy(strategy);
      affectedPairs.add(toPairKey(strategy.token0, strategy.token1));
    });
    latestFeeUpdates.forEach(([token0, token1, newFee]) => {
      this._tradingFeePPMByPair[toPairKey(token0, token1)] = newFee;
    });
    this._setLatestBlockNumber(latestBlockNumber);

    if (affectedPairs.size > 0) {
      logger.debug('Emitting onPairDataChanged', affectedPairs);
      this.emit(
        'onPairDataChanged',
        Array.from(affectedPairs).map(fromPairKey),
      );
    }
  }

  private _setLatestBlockNumber(blockNumber: number): void {
    this._latestBlockNumber = blockNumber;
  }

  private _setLatestTrade(trade: TradeData): void {
    if (!this.hasCachedPair(trade.sourceToken, trade.targetToken)) {
      throw new Error(
        `Pair ${toPairKey(
          trade.sourceToken,
          trade.targetToken,
        )} is not cached, cannot set latest trade`,
      );
    }
    const key = toPairKey(trade.sourceToken, trade.targetToken);
    this._latestTradesByPair[key] = trade;
    const directedKey = toDirectionKey(trade.sourceToken, trade.targetToken);
    this._latestTradesByDirectedPair[directedKey] = trade;
  }

  private _addStrategyOrders(strategy: EncodedStrategy): void {
    for (const tokenOrder of [
      [strategy.token0, strategy.token1],
      [strategy.token1, strategy.token0],
    ]) {
      const key = toDirectionKey(tokenOrder[0], tokenOrder[1]);
      const order: EncodedOrder =
        tokenOrder[0] === strategy.token0 ? strategy.order1 : strategy.order0;
      const existingOrders = this._ordersByDirectedPair[key];
      if (existingOrders) {
        existingOrders[strategy.id.toString()] = order;
      } else {
        this._ordersByDirectedPair[key] = {
          [strategy.id.toString()]: order,
        };
      }
    }
  }

  private _removeStrategyOrders(strategy: EncodedStrategy): void {
    for (const tokenOrder of [
      [strategy.token0, strategy.token1],
      [strategy.token1, strategy.token0],
    ]) {
      const key = toDirectionKey(tokenOrder[0], tokenOrder[1]);
      const existingOrders = this._ordersByDirectedPair[key];
      if (existingOrders) {
        delete existingOrders[strategy.id.toString()];
        // if there are no orders left for this pair, remove the pair from the map
        if (Object.keys(existingOrders).length === 0) {
          delete this._ordersByDirectedPair.key;
        }
      }
    }
  }

  private _addStrategy(strategy: EncodedStrategy): void {
    if (!this.hasCachedPair(strategy.token0, strategy.token1)) {
      throw new Error(
        `Pair ${toPairKey(
          strategy.token0,
          strategy.token1,
        )} is not cached, cannot add strategy`,
      );
    }
    const key = toPairKey(strategy.token0, strategy.token1);
    if (this._strategiesById[strategy.id.toString()]) {
      logger.debug(
        `Strategy ${strategy.id} already cached, under the pair ${key} - skipping`,
      );
      return;
    }
    const strategies = this._strategiesByPair[key] || [];
    strategies.push(strategy);
    this._strategiesByPair[key] = strategies;
    this._strategiesById[strategy.id.toString()] = strategy;
    this._addStrategyOrders(strategy);
  }

  private _updateStrategy(strategy: EncodedStrategy): void {
    if (!this.hasCachedPair(strategy.token0, strategy.token1)) {
      throw new Error(
        `Pair ${toPairKey(
          strategy.token0,
          strategy.token1,
        )} is not cached, cannot update strategy`,
      );
    }
    const key = toPairKey(strategy.token0, strategy.token1);
    const strategies = (this._strategiesByPair[key] || []).filter(
      s => !BigNumber.from(s.id).eq(strategy.id),
    );
    strategies.push(strategy);
    this._strategiesByPair[key] = strategies;
    this._strategiesById[strategy.id.toString()] = strategy;
    this._removeStrategyOrders(strategy);
    this._addStrategyOrders(strategy);
  }

  private _deleteStrategy(strategy: EncodedStrategy): void {
    if (!this.hasCachedPair(strategy.token0, strategy.token1)) {
      throw new Error(
        `Pair ${toPairKey(
          strategy.token0,
          strategy.token1,
        )} is not cached, cannot delete strategy`,
      );
    }
    const key = toPairKey(strategy.token0, strategy.token1);
    delete this._strategiesById[strategy.id.toString()];
    const strategies = (this._strategiesByPair[key] || []).filter(
      s => !BigNumber.from(s.id).eq(strategy.id),
    );
    this._strategiesByPair[key] = strategies;
    this._removeStrategyOrders(strategy);
  }

  //#endregion cache updates
}
