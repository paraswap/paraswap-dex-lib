import { Interface, Result } from '@ethersproject/abi';

import {
  VerifiedPoolTypes,
  SubgraphMainToken,
  SubgraphPoolAddressDictionary,
  SubgraphPoolBase,
  SubgraphToken,
  PoolState,
} from './types';

import { DeepReadonly } from 'ts-essentials';
import _, { keyBy, reverse, uniqBy } from 'lodash';
import { SwapSide } from '@paraswap/core';

interface BalancerPathHop {
  pool: SubgraphPoolBase;
  tokenIn: SubgraphToken;
  tokenOut: SubgraphToken;
}

export function decodeThrowError(
  contractInterface: Interface,
  functionName: string,
  resultEntry: { success: boolean; returnData: any },
  poolAddress: string,
): Result {
  if (!resultEntry.success)
    throw new Error(`Failed to execute ${functionName} for ${poolAddress}`);
  return contractInterface.decodeFunctionResult(
    functionName,
    resultEntry.returnData,
  );
}

export function isSupportedPool(poolType: string): boolean {
  return (
    poolType == VerifiedPoolTypes.PrimaryIssuePool ||
    poolType == VerifiedPoolTypes.SecondaryIssuePool
  );
}

//Todo: confirm this handles both primary and secondary
export function poolGetMainTokens(
  pool: Omit<SubgraphPoolBase, 'mainTokens'>,
  poolsMap: SubgraphPoolAddressDictionary,
): SubgraphMainToken[] {
  let mainTokens: SubgraphMainToken[] = [];

  for (const token of pool.tokens) {
    //skip bpt token
    if (token.address === pool.address) {
      continue;
    }
    const tokenPool = poolsMap[token.address];
    if (tokenPool && isSupportedPool(tokenPool.poolType)) {
      const securityToken = pool.tokens.find(token => {
        token.address === tokenPool.security;
      })!;
      mainTokens.push({
        ...securityToken,
        poolToken: token,
        pathToToken: [
          {
            poolId: tokenPool.id,
            poolAddress: tokenPool.address,
            token: securityToken,
          },
        ],
        isDeeplyNested: undefined,
      });
    } else {
      mainTokens.push({
        ...token,
        pathToToken: [],
        poolToken: token,
        isDeeplyNested: undefined,
      });
    }
  }

  return mainTokens;
}

export function getNewAmount(max: bigint, num: bigint): bigint {
  return max >= num ? num : 0n;
}

export function typecastReadOnlyPoolState(
  pool: DeepReadonly<PoolState>,
): PoolState {
  return _.cloneDeep(pool) as PoolState;
}

export function poolAddressMap(
  pools: SubgraphPoolBase[],
): SubgraphPoolAddressDictionary {
  return keyBy(pools, 'address');
}

export function poolIdMap(pools: SubgraphPoolBase[]): {
  [poolId: string]: SubgraphPoolBase;
} {
  return keyBy(pools, 'id');
}

function findRequiredMainTokenInPool(
  tokenToFind: string,
  pool: SubgraphPoolBase,
): SubgraphMainToken {
  const mainToken = pool.mainTokens.find(
    token => token.address.toLowerCase() === tokenToFind.toLowerCase(),
  );

  if (!mainToken) {
    throw new Error(`Main token does not exist in pool: ${tokenToFind}`);
  }

  return mainToken;
}

export function poolGetPathForTokenInOut(
  tokenInAddress: string,
  tokenOutAddress: string,
  pool: SubgraphPoolBase,
  poolsMap: SubgraphPoolAddressDictionary,
  side: SwapSide,
): BalancerPathHop[] {
  const tokenIn = findRequiredMainTokenInPool(tokenInAddress, pool);
  const tokenOut = findRequiredMainTokenInPool(tokenOutAddress, pool);

  const tokenInHops: BalancerPathHop[] = reverse([...tokenIn.pathToToken]).map(
    hop => ({
      pool: poolsMap[hop.poolAddress],
      tokenIn: hop.token,
      tokenOut: { address: hop.poolAddress, decimals: 18 },
    }),
  );

  const tokenOutHops: BalancerPathHop[] = tokenOut.pathToToken.map(hop => ({
    pool: poolsMap[hop.poolAddress],
    tokenIn: { address: hop.poolAddress, decimals: 18 },
    tokenOut: hop.token,
  }));

  const result = [
    ...tokenInHops,
    { pool, tokenIn: tokenIn.poolToken, tokenOut: tokenOut.poolToken },
    ...tokenOutHops,
  ];

  return side === SwapSide.SELL ? result : result.reverse();
}

export function getAllPoolsUsedInPaths(
  from: string,
  to: string,
  allowedPools: SubgraphPoolBase[],
  poolAddressMap: SubgraphPoolAddressDictionary,
  side: SwapSide,
) {
  //get all pools from the nested paths
  return uniqBy(
    allowedPools
      .map(pool =>
        poolGetPathForTokenInOut(
          from.toLowerCase(),
          to.toLowerCase(),
          pool,
          poolAddressMap,
          side,
        ).map(hop => hop.pool),
      )
      .flat(),
    'address',
  );
}
