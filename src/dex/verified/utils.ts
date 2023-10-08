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
import _ from 'lodash';

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
      });
    } else {
      mainTokens.push({
        ...token,
        pathToToken: [],
        poolToken: token,
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
