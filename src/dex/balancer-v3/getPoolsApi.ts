import axios from 'axios';
import { DeepReadonly } from 'ts-essentials';
import { apiUrl, BalancerV3Config, SUPPORTED_POOLS } from './config';
import { CommonImmutablePoolState, ImmutablePoolStateMap } from './types';
import { parseUnits } from 'ethers/lib/utils';

interface PoolToken {
  address: string;
  weight: string | null;
}

interface Pool {
  id: string;
  type: string;
  poolTokens: PoolToken[];
  factory: string;
}

interface QueryResponse {
  data: {
    poolGetAggregatorPools: Pool[];
  };
}

function createQuery(
  networkId: number,
  timestamp: number,
  poolTypes: SUPPORTED_POOLS[],
): string {
  const poolTypesString = poolTypes.map(type => `${type}`).join(', ');
  const networkString = BalancerV3Config.BalancerV3[networkId].apiNetworkName;
  return `
    query MyQuery {
      poolGetAggregatorPools(
        where: {chainIn: ${networkString}, protocolVersionIn: 3, poolTypeIn: [${poolTypesString}], createTime: {lt: ${timestamp}}}
      ) {
        id
        type
        poolTokens {
          address
          weight
        }
        factory
      }
    }
  `;
}

function toImmutablePoolStateMap(pools: Pool[]): ImmutablePoolStateMap {
  return pools.reduce((map, pool) => {
    const immutablePoolState: CommonImmutablePoolState = {
      tokens: pool.poolTokens.map(t => t.address),
      weights: pool.poolTokens.map(t =>
        t.weight ? parseUnits(t.weight, 18).toBigInt() : 0n,
      ),
      poolType: pool.type,
      // TODO add scalingFactors once API provides them
      // scalingFactors: pool.poolTokens.map(t => parseUnits('1', 18).toBigInt()),
      hookType: 'Unsupported',
    };

    map[pool.id] = immutablePoolState;
    return map;
  }, {} as ImmutablePoolStateMap);
}

// Any data from API will be immutable. Mutable data such as balances, etc will be fetched via onchain/event state.
export async function getPoolsApi(
  network: number,
  timestamp: number,
): Promise<ImmutablePoolStateMap> {
  try {
    const query = createQuery(
      network,
      timestamp,
      Object.values(SUPPORTED_POOLS),
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
    console.error('Error executing GraphQL query:', error);
    throw error;
  }
}
