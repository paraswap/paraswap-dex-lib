const fetchAllPoolsQuery = `#graphql
        query ($count: Int) {
            pools (first: $count, orderBy: totalLiquidity, orderDirection: desc, where: {active: true, publicSwap: true, liquidity_gt: 0}) {
              id
              address
              publicSwap
              swapFee
              totalWeight
              tokensList
              liquidity
              tokens {
                id
                address
                balance
                decimals
                symbol
                denormWeight
              }
            }
          }
      `;

const subgraphTimeout = 1000 * 10;


async function fetchAllSubgraphPools(): Promise < SubgraphPoolBase[] > {
    const cacheKey = 'AllSubgraphPools';
    const cachedPools = await this.dexHelper.cache.get(
      this.parentName,
      this.network,
      cacheKey,
    );
    if (cachedPools) {
      const allPools = JSON.parse(cachedPools);
      this.logger.info(
        `Got ${allPools.length} ${this.parentName}_${this.network} pools from cache`,
      );
      return allPools;
    }

    this.logger.info(
      `Fetching ${this.parentName}_${this.network} Pools from subgraph`,
    );
    const variables = {
      count: MAX_POOL_CNT,
    };
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      { query: fetchAllPoolsQuery, variables },
      subgraphTimeout,
    );

    if (!(data && data.pools))
      throw new Error('Unable to fetch pools from the subgraph');

    this.dexHelper.cache.setex(
      this.parentName,
      this.network,
      cacheKey,
      POOL_CACHE_TTL,
      JSON.stringify(data.pools),
    );
    const allPools = data.pools;
    this.logger.info(
      `Got ${allPools.length} ${this.parentName}_${this.network} pools from subgraph`,
    );
    return allPools;
  }
