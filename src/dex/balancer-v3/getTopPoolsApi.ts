import axios from 'axios';
import { apiUrl, BalancerV3Config, disabledPoolIds } from './config';

interface PoolToken {
  address: string;
  decimals: number;
  underlyingToken?: {
    address: string;
    decimals: number;
    underlyingTokenAddress: string;
  };
}

export interface Pool {
  address: string;
  poolTokens: PoolToken[];
  dynamicData: {
    totalLiquidity: string;
  };
}

interface QueryResponse {
  data: {
    poolGetAggregatorPools: Pool[];
  };
}

function createQuery(
  networkId: number,
  poolsFilter: string[],
  count: number,
): string {
  const disabledPoolIdsString = disabledPoolIds.BalancerV3[networkId]
    ?.map(p => `"${p}"`)
    .join(', ');

  const networkString = BalancerV3Config.BalancerV3[networkId].apiNetworkName;
  const poolIdString = poolsFilter.map(a => `"${a}"`).join(', ');
  // Build the where clause conditionally
  const whereClause = {
    chainIn: networkString,
    protocolVersionIn: 3,
    hasHook: false,
    idIn: `[${poolIdString}]`,
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
        first: ${count}
        orderBy: totalLiquidity
        orderDirection: desc
      ) {
        address
        poolTokens {
          address
          decimals
          underlyingToken {
            address
            decimals
            underlyingTokenAddress
          }
        }
        dynamicData {
          totalLiquidity
        }
      }
    }
  `;
}

export async function getTopPoolsApi(
  networkId: number,
  poolsFilter: string[],
  count: number,
): Promise<Pool[]> {
  try {
    const query = createQuery(networkId, poolsFilter, count);
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
    return pools;
  } catch (error) {
    // console.error('Error executing GraphQL query:', error);
    throw error;
  }
}
