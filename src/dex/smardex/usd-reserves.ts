import { Network, SUBGRAPH_TIMEOUT } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Address, Logger } from '../../types';
import { fetchPaginatedPairUSDReservesQuery } from './subgraph-queries';
import { SubgraphPairReserve, USDReserve } from './types';

// Service for managing USD reserves for Smardex
export class USDReservesService {
  private static readonly CACHE_KEY_LOCK = 'cached-reserves-usd';
  private static readonly CACHE_TTL_LOCK = 120; // 2 minutes
  private static readonly CACHE_TTL_RESERVES = 60 * 60; // 1 hour
  private static readonly CACHE_RESERVE_KEY_SUFFIX = '-usd-reserve';
  private readonly subgraphURL: string;
  private readonly dexHelper: IDexHelper;
  private readonly dexKey: string;
  private readonly network: Network;
  private readonly logger: Logger;

  constructor(
    dexKey: string,
    network: Network,
    dexHelper: IDexHelper,
    subgraphURL: string,
  ) {
    this.dexKey = dexKey;
    this.subgraphURL = subgraphURL;
    this.network = network;
    this.dexHelper = dexHelper;
    this.logger = dexHelper.getLogger();
  }

  // Retrieves USD reserve for a specific pair from the cache
  async getUSDReserveForPair(pairAddress: Address): Promise<number> {
    const suffix = USDReservesService.CACHE_RESERVE_KEY_SUFFIX;
    await this.refreshUSDReservesIfNeeded();
    const cachedReserve = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      `${pairAddress.toLowerCase()}${suffix}`,
    );
    return cachedReserve ? Number(cachedReserve) : 0;
  }

  // Updates USD reserves if they are outdated
  private async refreshUSDReservesIfNeeded(): Promise<void> {
    if (!this.subgraphURL || !(await this.areUSDReservesOutdated())) {
      return;
    }
    await this.lockUSDReservesCache();
    const pairs = await this.fetchSubgraphReserves();
    await this.cacheUSDReserves(pairs);
  }

  // Acquires a lock on the USD reserves cache
  private async lockUSDReservesCache(): Promise<void> {
    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      USDReservesService.CACHE_KEY_LOCK,
      USDReservesService.CACHE_TTL_LOCK,
      Date.now().toString(),
    );
  }

  // Checks if the USD reserves are outdated
  private async areUSDReservesOutdated(): Promise<boolean> {
    const lastUpdate = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      USDReservesService.CACHE_KEY_LOCK,
    );
    return !lastUpdate;
  }

  // Caches USD reserves for all pairs
  private async cacheUSDReserves(reserves: USDReserve[]): Promise<void> {
    const suffix = USDReservesService.CACHE_RESERVE_KEY_SUFFIX;
    for (const reserve of reserves) {
      await this.dexHelper.cache.setex(
        this.dexKey,
        this.network,
        `${reserve.pairAddress}${suffix}`,
        USDReservesService.CACHE_TTL_RESERVES,
        reserve.reserveUSD.toString(),
      );
    }
  }

  async fetchSubgraphReserves(): Promise<USDReserve[]> {
    const pageSize = 100;
    let page = 1;
    let pairs: USDReserve[] = [];
    let paginatedPairs = await this.fetchPaginatedReserves(page, pageSize);
    while (paginatedPairs.length > 0) {
      pairs = [...pairs, ...paginatedPairs];
      page++;
      paginatedPairs = await this.fetchPaginatedReserves(page, pageSize);
    }
    return pairs;
  }

  // Fetches pair data from the subgraph
  async fetchPaginatedReserves(
    page: number,
    pageSize: number,
  ): Promise<USDReserve[]> {
    const skip = Math.max(0, page - 1) * pageSize;
    const limit = pageSize;
    const paginatedQuery: string = fetchPaginatedPairUSDReservesQuery(
      limit,
      skip,
    );

    try {
      const apiToken = this.dexHelper.config.data.smardexSubgraphAuthToken!;
      const response = await this.dexHelper.httpRequest.post(
        this.subgraphURL,
        { query: paginatedQuery },
        SUBGRAPH_TIMEOUT,
        { 'x-api-key': apiToken },
      );
      if (!response.data || !response.data.pairs) {
        return [];
      }
      return response.data.pairs.map((pair: SubgraphPairReserve) => ({
        pairAddress: pair.id,
        reserveUSD: pair.reserveUSD,
      }));
    } catch (error) {
      this.logger.error(
        'Error fetching paginated reserves from subgraph',
        error,
      );
      return [];
    }
  }
}
