import { getAddress } from '@ethersproject/address';
import { Interface, Result } from '@ethersproject/abi';
import { getBigIntPow } from '../../utils';
import { BI_POWS } from '../../bigint-constants';

import {
  VerifiedPoolTypes,
  SubgraphMainToken,
  SubgraphPoolAddressDictionary,
  SubgraphPoolBase,
  SubgraphToken,
} from './types';
import { reverse, uniqBy } from 'lodash';

interface BalancerPathHop {
  pool: SubgraphPoolBase;
  tokenIn: SubgraphToken;
  tokenOut: SubgraphToken;
}

export const isSameAddress = (address1: string, address2: string): boolean =>
  getAddress(address1) === getAddress(address2);

export function getTokenScalingFactor(tokenDecimals: number): bigint {
  return BI_POWS[18] * getBigIntPow(18 - tokenDecimals);
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

// export function poolGetPathForTokenInOut(
//   tokenInAddress: string,
//   tokenOutAddress: string,
//   pool: SubgraphPoolBase,
//   poolsMap: SubgraphPoolAddressDictionary,
// ): BalancerPathHop[] {
//   const tokenIn = findRequiredMainTokenInPool(tokenInAddress, pool);
//   const tokenOut = findRequiredMainTokenInPool(tokenOutAddress, pool);

//   const tokenInHops: BalancerPathHop[] = reverse([...tokenIn.pathToToken]).map(
//     hop => ({
//       pool: poolsMap[hop.poolAddress],
//       tokenIn: hop.token,
//       tokenOut: { address: hop.poolAddress, decimals: 18 },
//     }),
//   );

//   const tokenOutHops: BalancerPathHop[] = tokenOut.pathToToken.map(hop => ({
//     pool: poolsMap[hop.poolAddress],
//     tokenIn: { address: hop.poolAddress, decimals: 18 },
//     tokenOut: hop.token,
//   }));

//   return [
//     ...tokenInHops,
//     { pool, tokenIn: tokenIn.poolToken, tokenOut: tokenOut.poolToken },
//     ...tokenOutHops,
//   ];
// }

// export function getAllPoolsUsedInPaths(
//   from: string,
//   to: string,
//   allowedPools: SubgraphPoolBase[],
//   poolAddressMap: SubgraphPoolAddressDictionary,
// ) {
//   //get all pools from the nested paths
//   return uniqBy(
//     allowedPools
//       .map(pool =>
//         poolGetPathForTokenInOut(
//           from.toLowerCase(),
//           to.toLowerCase(),
//           pool,
//           poolAddressMap,
//         ).map(hop => hop.pool),
//       )
//       .flat(),
//     'address',
//   );
// }

//Todo: confirm this handles both primary and secondary
export function poolGetMainTokens(
  pool: Omit<SubgraphPoolBase, 'mainTokens'>,
  poolsMap: SubgraphPoolAddressDictionary,
): SubgraphMainToken[] {
  let mainTokens: SubgraphMainToken[] = [];

  for (const token of pool.tokens) {
    //skip
    if (token.address === pool.address) {
      continue;
    }
    const tokenPool = poolsMap[token.address];
    if (tokenPool && isPrimaryPool(tokenPool.poolType)) {
      //since primary main token is the security token used
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
    } else if (tokenPool && isSecondaryPool(tokenPool.poolType)) {
      //since secondary main token is the currency token used
      const currency = pool.tokens.find(token => {
        token.address === tokenPool.currency;
      })!;
      mainTokens.push({
        ...currency,
        poolToken: token,
        pathToToken: [
          {
            poolId: tokenPool.id,
            poolAddress: tokenPool.address,
            token: currency,
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

function isPrimaryPool(poolType: string): boolean {
  return poolType == VerifiedPoolTypes.PrimaryIssuePool;
}

function isSecondaryPool(poolType: string): boolean {
  return poolType == VerifiedPoolTypes.SecondaryIssuePool;
}

// function findRequiredMainTokenInPool(
//   tokenToFind: string,
//   pool: SubgraphPoolBase,
// ): SubgraphMainToken {
//   const mainToken = pool.mainTokens.find(
//     token => token.address.toLowerCase() === tokenToFind.toLowerCase(),
//   );

//   if (!mainToken) {
//     throw new Error(`Main token does not exist in pool: ${tokenToFind}`);
//   }

//   return mainToken;
// }
