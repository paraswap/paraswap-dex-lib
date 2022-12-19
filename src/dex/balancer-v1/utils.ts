import { Contract } from 'web3-eth-contract';
import { PoolInfo, PoolState } from './types';
import { BALANCES_MULTICALL_POOLS_LIMIT } from './config';
import { sliceCalls } from '../../utils';

export async function generatePoolStates(
  pools: PoolInfo[],
  balancerMulticall: Contract,
  blockNumber: number,
): Promise<PoolState[]> {
  if (!pools.length) throw new Error('No pools provided to generatePoolStates');

  const poolWithTokensAddresses = new Array<string[]>(pools.length);

  for (let i = 0; i < pools.length; ++i) {
    const pool = pools[i];
    const arr = new Array<string>(pool.tokensList.length + 1);
    arr[0] = pool.id;
    for (let j = 0; j < pool.tokensList.length; ++j) {
      arr[j + 1] = pool.tokensList[j];
    }
    poolWithTokensAddresses[i] = arr;
  }

  const poolTokenBalances = (
    await Promise.all(
      sliceCalls({
        inputArray: poolWithTokensAddresses,
        sliceLength: BALANCES_MULTICALL_POOLS_LIMIT,
        execute: async (slicedPoolWithTokensAddresses: string[][]) => {
          const totalTokensInPools = slicedPoolWithTokensAddresses.reduce(
            (acc, arr) => acc + arr.length - 1, // don't count pool address
            0,
          );

          return await balancerMulticall.methods
            .getPoolInfo(slicedPoolWithTokensAddresses, totalTokensInPools)
            .call({}, blockNumber);
        },
      }),
    )
  ).flat();

  let j = 0;
  const ret = new Array<PoolState>(pools.length);
  for (let i = 0; i < pools.length; ++i) {
    const pool = pools[i];
    const poolState: PoolState = { tokenBalances: {} };
    for (const tokenAddress of pool.tokensList) {
      poolState.tokenBalances[tokenAddress] = BigInt(poolTokenBalances[j]);
      ++j;
    }
    ret[i] = poolState;
  }

  return ret;
}
