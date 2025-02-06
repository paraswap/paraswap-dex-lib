import axios from 'axios';
import {
  apiUrl,
  BalancerV3Config,
  disabledPoolIds,
  SUPPORTED_POOLS,
} from './config';
import { CommonImmutablePoolState, ImmutablePoolStateMap } from './types';
import { parseUnits } from 'ethers/lib/utils';
import { HooksConfigMap } from './hooks/balancer-hook-event-subscriber';

interface PoolToken {
  address: string;
  weight: string | null;
  isErc4626: boolean;
  underlyingToken: {
    address: string;
  } | null;
}

interface Pool {
  id: string;
  type: string;
  poolTokens: PoolToken[];
  hook: {
    address: string;
  } | null;
}

interface QueryResponse {
  data: {
    poolGetAggregatorPools: Pool[];
  };
}

function createQuery(
  networkId: number,
  poolTypes: SUPPORTED_POOLS[],
  timestamp?: number,
): string {
  const poolTypesString = poolTypes.map(type => `${type}`).join(', ');
  const networkString = BalancerV3Config.BalancerV3[networkId].apiNetworkName;
  const disabledPoolIdsString = disabledPoolIds.BalancerV3[networkId]
    ?.map(p => `"${p}"`)
    .join(', ');

  // Build the where clause conditionally
  const whereClause = {
    chainIn: networkString,
    protocolVersionIn: 3,
    poolTypeIn: `[${poolTypesString}]`,
    ...(timestamp && { createTime: `{lt: ${timestamp}}` }),
    ...(disabledPoolIdsString && { idNotIn: `[${disabledPoolIdsString}]` }),
  };

  // Convert where clause to string, filtering out undefined values
  const whereString = Object.entries(whereClause)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  return `
    query MyQuery {
      poolGetAggregatorPools(
        where: {${whereString}}
      ) {
        id
        type
        poolTokens {
          address
          weight
          isErc4626
          underlyingToken {
            address
          }
        }
        hook {
          address
        }
      }
    }
  `;
}

function toImmutablePoolStateMap(
  pools: Pool[],
  hooksConfigMap: HooksConfigMap,
): ImmutablePoolStateMap {
  return (
    pools
      // First filter out pools with hooks that aren't in hooksMap
      .filter(
        pool =>
          !pool.hook || (pool.hook && pool.hook.address in hooksConfigMap),
      )
      .reduce((map, pool) => {
        const immutablePoolState: CommonImmutablePoolState = {
          poolAddress: pool.id,
          tokens: pool.poolTokens.map(t => t.address),
          tokensUnderlying: pool.poolTokens.map(t =>
            t.underlyingToken ? t.underlyingToken.address : null,
          ),
          weights: pool.poolTokens.map(t =>
            t.weight ? parseUnits(t.weight, 18).toBigInt() : 0n,
          ),
          poolType: pool.type,
          hookAddress: pool.hook ? pool.hook.address : undefined,
          hookType: pool.hook
            ? hooksConfigMap[pool.hook.address].type
            : undefined,
          supportsUnbalancedLiquidity: true,
        };
        map[pool.id] = immutablePoolState;
        return map;
      }, {} as ImmutablePoolStateMap)
  );
}

// Any data from API will be immutable. Mutable data such as balances, etc will be fetched via onchain/event state.
export async function getPoolsApi(
  network: number,
  hooksConfigMap: HooksConfigMap,
  timestamp?: number,
): Promise<ImmutablePoolStateMap> {
  try {
    const query = createQuery(
      network,
      Object.values(SUPPORTED_POOLS),
      timestamp,
    );
    const response = await axios.post<QueryResponse>(
      apiUrl,
      {
        query,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const pools = response.data.data.poolGetAggregatorPools;
    return toImmutablePoolStateMap(pools, hooksConfigMap);
  } catch (error) {
    // console.error('Error executing GraphQL query:', error);
    throw error;
  }
}
