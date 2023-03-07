import { getAddress } from '@ethersproject/address';
import { Interface, Result } from '@ethersproject/abi';
import { parseFixed, BigNumber } from '@ethersproject/bignumber';
import { getBigIntPow } from '../../utils';
import { BI_POWS } from '../../bigint-constants';

import {
  BalancerPoolTypes,
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

/**
 * Parses a fixed-point decimal string into a BigNumber. If we do not have enough decimals to express the number, we truncate it.
 * @param value
 * @param decimals
 * @returns BigNumber
 */
export function safeParseFixed(value: string, decimals = 0): BigNumber {
  const [integer, fraction] = value.split('.');
  if (!fraction) {
    return parseFixed(value, decimals);
  }
  const safeValue = integer + '.' + fraction.slice(0, decimals);
  return parseFixed(safeValue, decimals);
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

export function poolGetPathForTokenInOut(
  tokenInAddress: string,
  tokenOutAddress: string,
  pool: SubgraphPoolBase,
  poolsMap: SubgraphPoolAddressDictionary,
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

  return [
    ...tokenInHops,
    { pool, tokenIn: tokenIn.poolToken, tokenOut: tokenOut.poolToken },
    ...tokenOutHops,
  ];
}

export function getAllPoolsUsedInPaths(
  from: string,
  to: string,
  allowedPools: SubgraphPoolBase[],
  poolAddressMap: SubgraphPoolAddressDictionary,
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
        ).map(hop => hop.pool),
      )
      .flat(),
    'address',
  );
}

export function poolGetMainTokens(
  pool: Omit<SubgraphPoolBase, 'mainTokens'>,
  poolsMap: SubgraphPoolAddressDictionary,
): SubgraphMainToken[] {
  let mainTokens: SubgraphMainToken[] = [];

  for (const token of pool.tokens) {
    //skip the phantom bpt
    if (token.address === pool.address) {
      continue;
    }

    const tokenPool = poolsMap[token.address];

    if (tokenPool && isLinearPool(tokenPool.poolType)) {
      //nested linear pool
      mainTokens.push({
        ...tokenPool.tokens[tokenPool.mainIndex],
        isDeeplyNested: false,
        poolToken: token,
        pathToToken: [
          {
            poolId: tokenPool.id,
            poolAddress: tokenPool.address,
            token: tokenPool.tokens[tokenPool.mainIndex],
          },
        ],
      });
    } else if (tokenPool && isPhantomStablePool(tokenPool.poolType)) {
      const nestedMainTokens = poolGetMainTokens(tokenPool, poolsMap);
      //nested phantom stable
      mainTokens = [
        ...mainTokens,
        //nested main tokens map to the phantom bpt
        ...nestedMainTokens.map(mainToken => ({
          ...mainToken,
          pathToToken: [
            {
              poolId: tokenPool.id,
              poolAddress: tokenPool.address,
              token: mainToken.poolToken,
            },
            ...mainToken.pathToToken,
          ],
          poolToken: token,
          isDeeplyNested: true,
        })),
      ];
    } else {
      mainTokens.push({
        ...token,
        pathToToken: [],
        poolToken: token,
        isDeeplyNested: false,
      });
    }
  }

  return mainTokens;
}

function isLinearPool(poolType: string) {
  return (
    poolType === BalancerPoolTypes.Linear ||
    poolType === BalancerPoolTypes.AaveLinear ||
    poolType === BalancerPoolTypes.ERC4626Linear
  );
}

function isPhantomStablePool(poolType: string) {
  return (
    poolType === BalancerPoolTypes.StablePhantom ||
    poolType === BalancerPoolTypes.ComposableStable
  );
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
