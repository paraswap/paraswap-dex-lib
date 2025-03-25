import { SubgraphPool, Tick } from './types';
import { SUBGRAPH_TIMEOUT } from './constants';
import { IDexHelper } from '../../dex-helper';
import { Logger } from 'log4js';

export async function queryTicksForPool(
  dexHelper: IDexHelper,
  subgraphUrl: string,
  blockNumber: number,
  id: string,
): Promise<Tick[]> {
  const ticksLimit = 300;

  const poolQuery = `query {
      pools(
        block: { number: ${blockNumber} },
        where: {id: "${id}"}
      ) {
        ticks(first: ${ticksLimit}) {
          id
          liquidityGross
          liquidityNet
          tickIdx
        }
      }
  }`;

  const { data } = await dexHelper.httpRequest.querySubgraph<{
    data: {
      pools: SubgraphPool[];
    };
  }>(
    subgraphUrl,
    {
      query: poolQuery,
      variables: {},
    },
    { timeout: SUBGRAPH_TIMEOUT },
  );

  return data.pools[0]?.ticks || [];
}

export async function queryOnePageForAllAvailablePoolsFromSubgraph(
  dexHelper: IDexHelper,
  logger: Logger,
  dexKey: string,
  subgraphUrl: string,
  blockNumber: number,
  skip: number,
  limit: number,
  latestBlock = false,
): Promise<SubgraphPool[]> {
  const ticksLimit = 300;

  const poolsQuery = `query ($skip: Int!) {
      pools(
        ${latestBlock ? '' : `block: { number: ${blockNumber} }`}
        orderBy: volumeUSD
        orderDirection: desc
        skip: $skip
        first: ${limit}
      ) {
        id
        fee: feeTier
        tickSpacing
        token0 {
          address: id
        }
        token1 {
          address: id
        }
        hooks
        tick
        ticks(first: ${ticksLimit}) {
          id
          liquidityGross
          liquidityNet
          tickIdx
        }
      }
    }`;

  // console.log('poolsQuery: ', poolsQuery);

  const res = await dexHelper.httpRequest.querySubgraph<{
    data: {
      pools: SubgraphPool[];
    };
    errors?: { message: string }[];
  }>(
    subgraphUrl,
    {
      query: poolsQuery,
      variables: { skip: skip },
    },
    { timeout: SUBGRAPH_TIMEOUT },
  );

  if (
    res.errors &&
    res.errors.length &&
    res.errors[0].message.includes('missing block')
  ) {
    logger.info(`${dexKey}: subgraph fallback to the latest block...`);
    return queryOnePageForAllAvailablePoolsFromSubgraph(
      dexHelper,
      logger,
      dexKey,
      subgraphUrl,
      blockNumber,
      skip,
      limit,
      true,
    );
  }

  return res.data.pools;
}
