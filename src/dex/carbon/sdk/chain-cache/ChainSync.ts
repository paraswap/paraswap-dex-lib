import { ChainCache } from './ChainCache';
import { findAndRemoveLeading, toPairKey } from './utils';
import { Logger } from '../common/logger';
import {
  BlockMetadata,
  EncodedStrategy,
  Fetcher,
  TokenPair,
  TradeData,
} from '../common/types';

const logger = new Logger('index.ts');

const BLOCKS_TO_KEEP = 3;

export class ChainSync {
  private _fetcher: Fetcher;
  private _chainCache: ChainCache;
  private _syncCalled: boolean = false;
  private _slowPollPairs: boolean = false;
  private _pairs: TokenPair[] = [];
  // keep the time stamp of last fetch
  private _lastFetch: number = Date.now();
  private _initialSyncDone: boolean = false;

  constructor(fetcher: Fetcher, chainCache: ChainCache) {
    this._fetcher = fetcher;
    this._chainCache = chainCache;
  }

  public async startDataSync(): Promise<void> {
    logger.debug('startDataSync called');
    if (this._syncCalled) {
      throw new Error('ChainSync.startDataSync() can only be called once');
    }
    this._syncCalled = true;
    const blockNumber = await this._fetcher.getBlockNumber();
    if (this._chainCache.getLatestBlockNumber() === 0) {
      logger.debug('startDataSync - cache is new', arguments);
      // cache starts from scratch so we want to avoid getting events from the beginning of time
      this._chainCache.applyBatchedUpdates(blockNumber, [], [], [], []);
    }

    await Promise.all([
      this._trackFees(),
      this._populatePairsData(),
      this._syncEvents(),
    ]);
  }

  private async _trackFees(): Promise<void> {
    logger.debug('_trackFees called');
    const tradingFeePPM = await this._fetcher.tradingFeePPM();
    this._chainCache.tradingFeePPM = tradingFeePPM;
    this._fetcher.onTradingFeePPMUpdated(
      (prevFeePPM: number, newFeePPM: number) => {
        logger.debug('tradingFeePPM updated from', prevFeePPM, 'to', newFeePPM);
        this._chainCache.tradingFeePPM = newFeePPM;
      },
    );
  }

  // `_populatePairsData` sets timeout and returns immediately. It does the following:
  // 1. Fetches all token pairs from the fetcher
  // 2. selects a pair that's not in the cache
  // 3. fetches strategies for the pair
  // 4. adds the pair to the cache
  // 5. sets short timeout to continue with the next pair
  // 6. if there are no more pairs, it sets a timeout to call itself again
  private async _populatePairsData(): Promise<void> {
    logger.debug('_populatePairsData called');
    this._pairs = [];
    // keep the time stamp of last fetch
    this._lastFetch = Date.now();
    // this indicates we want to poll for pairs only once a minute.
    // Set this to false when we have an indication that new pair was created - which we want to fetch now
    this._slowPollPairs = false;

    const processPairs = async () => {
      try {
        if (this._pairs.length === 0) {
          // if we have no pairs we need to fetch - unless we're in slow poll mode and less than a minute has passed since last fetch
          if (this._slowPollPairs && Date.now() - this._lastFetch < 60000) {
            // go back to sleep
            setTimeout(processPairs, 1000);
            return;
          }
          logger.debug('_populatePairsData fetches pairs');
          this._pairs = [...(await this._fetcher.pairs())];
          logger.debug('_populatePairsData fetched pairs', this._pairs);
          this._lastFetch = Date.now();
        }
        // let's find the first pair that's not in the cache and clear it from the list along with all the items before it
        const nextPairToSync = findAndRemoveLeading<TokenPair>(
          this._pairs,
          pair => !this._chainCache.hasCachedPair(pair[0], pair[1]),
        );
        if (nextPairToSync) {
          logger.debug('_populatePairsData adds pair to cache', nextPairToSync);
          // we have a pair to sync - let's do it - add its strategies to the cache and then to minimal timeout to process the next pair
          await this.syncPairData(
            nextPairToSync[0],
            nextPairToSync[1],
            !this._initialSyncDone,
          );
          setTimeout(processPairs, 1);
        } else {
          // list is now empty and there are no more pairs to sync - we can poll them less frequently
          // we will wake up once a second just to check if we're still in slow poll mode,
          // but if not - we will actually poll once a minute
          logger.debug(
            '_populatePairsData handled all pairs and goes to slow poll mode',
          );
          this._slowPollPairs = true;
          this._initialSyncDone = true;
          setTimeout(processPairs, 1000);
        }
      } catch (e) {
        logger.error('Error while syncing pairs data', e);
        setTimeout(processPairs, 60000);
      }
    };
    setTimeout(processPairs, 1);
  }

  public async syncPairData(
    token0: string,
    token1: string,
    noPairAddedEvent: boolean = false,
  ): Promise<void> {
    if (!this._syncCalled) {
      throw new Error(
        'ChainSync.startDataSync() must be called before syncPairData()',
      );
    }
    const strategies = await this._fetcher.strategiesByPair(token0, token1);
    if (this._chainCache.hasCachedPair(token0, token1)) return;
    this._chainCache.addPair(token0, token1, strategies, noPairAddedEvent);
  }

  // used to break the blocks between latestBlock + 1 and currentBlock to chunks of 1000 blocks
  private _getBlockChunks(
    startBlock: number,
    endBlock: number,
    chunkSize: number,
  ): number[][] {
    const blockChunks = [];
    for (let i = startBlock; i <= endBlock; i += chunkSize) {
      const chunkStart = i;
      const chunkEnd = Math.min(i + chunkSize - 1, endBlock);
      blockChunks.push([chunkStart, chunkEnd]);
    }
    return blockChunks;
  }

  private async _syncEvents(): Promise<void> {
    logger.debug('_syncEvents called');
    const interval = 1000; // 1 second
    const processEvents = async () => {
      try {
        const latestBlock = this._chainCache.getLatestBlockNumber();
        const currentBlock = await this._fetcher.getBlockNumber();

        if (currentBlock > latestBlock) {
          if (await this._detectReorg(currentBlock)) {
            logger.debug('_syncEvents detected reorg - resetting');
            this._chainCache.clear();
            this._chainCache.applyBatchedUpdates(currentBlock, [], [], [], []);
            this._resetPairsFetching();
            setTimeout(processEvents, 1);
            return;
          }

          const cachedPairs = new Set<string>(
            this._chainCache
              .getCachedPairs()
              .map(pair => toPairKey(pair[0], pair[1])),
          );

          logger.debug(
            '_syncEvents fetches events',
            latestBlock + 1,
            currentBlock,
          );
          const blockChunks = this._getBlockChunks(
            latestBlock + 1,
            currentBlock,
            1000,
          );
          logger.debug('_syncEvents block chunks', blockChunks);

          const createdStrategiesChunks: EncodedStrategy[][] = [];
          const updatedStrategiesChunks: EncodedStrategy[][] = [];
          const deletedStrategiesChunks: EncodedStrategy[][] = [];
          const tradesChunks: TradeData[][] = [];

          for (const blockChunk of blockChunks) {
            logger.debug('_syncEvents fetches events for chunk', blockChunk);
            const createdStrategiesChunk: EncodedStrategy[] =
              await this._fetcher.getLatestStrategyCreatedStrategies(
                blockChunk[0],
                blockChunk[1],
              );
            const updatedStrategiesChunk: EncodedStrategy[] =
              await this._fetcher.getLatestStrategyUpdatedStrategies(
                blockChunk[0],
                blockChunk[1],
              );
            const deletedStrategiesChunk: EncodedStrategy[] =
              await this._fetcher.getLatestStrategyDeletedStrategies(
                blockChunk[0],
                blockChunk[1],
              );
            const tradesChunk: TradeData[] =
              await this._fetcher.getLatestTokensTradedTrades(
                blockChunk[0],
                blockChunk[1],
              );

            createdStrategiesChunks.push(createdStrategiesChunk);
            updatedStrategiesChunks.push(updatedStrategiesChunk);
            deletedStrategiesChunks.push(deletedStrategiesChunk);
            tradesChunks.push(tradesChunk);
            logger.debug(
              '_syncEvents fetched the following events for chunks',
              blockChunks,
              {
                createdStrategiesChunk,
                updatedStrategiesChunk,
                deletedStrategiesChunk,
                tradesChunk,
              },
            );
          }

          const createdStrategies = createdStrategiesChunks.flat();
          const updatedStrategies = updatedStrategiesChunks.flat();
          const deletedStrategies = deletedStrategiesChunks.flat();
          const trades = tradesChunks.flat();

          logger.debug(
            '_syncEvents fetched events',
            createdStrategies,
            updatedStrategies,
            deletedStrategies,
            trades,
          );

          // let's check created strategies and see if we have a pair that's not cached yet,
          // which means we need to set slow poll mode to false so that it will be fetched quickly
          for (const strategy of createdStrategies) {
            if (
              !this._chainCache.hasCachedPair(strategy.token0, strategy.token1)
            ) {
              logger.debug(
                '_syncEvents sets slow poll mode to false because of new pair',
                strategy.token0,
                strategy.token1,
              );
              this._slowPollPairs = false;
              break;
            }
          }

          this._chainCache.applyBatchedUpdates(
            currentBlock,
            trades.filter(trade =>
              cachedPairs.has(toPairKey(trade.sourceToken, trade.targetToken)),
            ),
            createdStrategies.filter(strategy =>
              cachedPairs.has(toPairKey(strategy.token0, strategy.token1)),
            ),
            updatedStrategies.filter(strategy =>
              cachedPairs.has(toPairKey(strategy.token0, strategy.token1)),
            ),
            deletedStrategies.filter(strategy =>
              cachedPairs.has(toPairKey(strategy.token0, strategy.token1)),
            ),
          );
        }
      } catch (err) {
        logger.error('Error syncing events:', err);
      }

      setTimeout(processEvents, interval);
    };
    setTimeout(processEvents, 1);
  }
  private _resetPairsFetching() {
    this._pairs = [];
    this._slowPollPairs = false;
    this._initialSyncDone = false;
  }

  private async _detectReorg(currentBlock: number): Promise<boolean> {
    logger.debug('_detectReorg called');
    const blocksMetadata: BlockMetadata[] = this._chainCache.blocksMetadata;
    const numberToBlockMetadata: { [key: number]: BlockMetadata } = {};
    for (let blockMetadata of blocksMetadata) {
      const { number, hash } = blockMetadata;
      if (number > currentBlock) {
        logger.log(
          'reorg detected for block number',
          number,
          'larger than current block',
          currentBlock,
          'with hash',
          hash,
        );
        return true;
      }
      const currentHash = (await this._fetcher.getBlock(number)).hash;
      if (hash !== currentHash) {
        logger.log(
          'reorg detected for block number',
          number,
          'old hash',
          hash,
          'new hash',
          currentHash,
        );
        return true;
      }
      // blockMetadata is valid, let's store it so that we don't have to fetch it again below
      numberToBlockMetadata[number] = blockMetadata;
    }

    // no reorg detected
    logger.debug('_detectReorg no reorg detected, updating blocks metadata');
    // let's store the new blocks metadata
    const latestBlocksMetadata: BlockMetadata[] = [];
    for (let i = 0; i < BLOCKS_TO_KEEP; i++) {
      // get the blocks metadata either from numberToBlockMetadata or from the blockchain
      if (numberToBlockMetadata[currentBlock - i]) {
        latestBlocksMetadata.push(numberToBlockMetadata[currentBlock - i]);
      } else {
        latestBlocksMetadata.push(
          await this._fetcher.getBlock(currentBlock - i),
        );
      }
    }
    this._chainCache.blocksMetadata = latestBlocksMetadata;
    logger.debug('_detectReorg updated blocks metadata');

    return false;
  }
}
