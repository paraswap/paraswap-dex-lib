import axios from 'axios';
import {
  apiUrl,
  BalancerV3Config,
  disabledPoolIds,
  SUPPORTED_POOLS,
} from './config';
import { CommonImmutablePoolState, ImmutablePoolStateMap } from './types';
import { parseUnits } from 'ethers/lib/utils';

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
    hasHook: false,
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
      }
    }
  `;
}

function toImmutablePoolStateMap(pools: Pool[]): ImmutablePoolStateMap {
  return pools.reduce((map, pool) => {
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
      // TODO add scalingFactors once API provides them
      // scalingFactors: pool.poolTokens.map(t => parseUnits('1', 18).toBigInt()),
      // TODO Hook support will be added in future PR
      hookType: undefined,
    };

    map[pool.id] = immutablePoolState;
    return map;
  }, {} as ImmutablePoolStateMap);
}

// Any data from API will be immutable. Mutable data such as balances, etc will be fetched via onchain/event state.
export async function getPoolsApi(
  network: number,
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
    return toImmutablePoolStateMap(pools);
  } catch (error) {
    // console.error('Error executing GraphQL query:', error);
    throw error;
  }
}
