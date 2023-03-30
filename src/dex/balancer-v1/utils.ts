import { Contract } from 'web3-eth-contract';
import { PoolInfo, PoolState } from './types';
import { BALANCES_MULTICALL_POOLS_LIMIT } from './config';
import { blockAndTryAggregate, sliceCalls } from '../../utils';
import { StateWithBlock } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';
import { assert } from 'ts-essentials';

export async function generatePoolStates(
  dexHelper: IDexHelper,
  pools: PoolInfo[],
  balancerMulticall: Contract,
  blockNumber: number | 'latest',
): Promise<StateWithBlock<PoolState[]>> {
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

  let _blockNumber: number | undefined = undefined;

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

          const result = await blockAndTryAggregate(
            true,
            dexHelper.multiContract,
            [
              {
                target: balancerMulticall.options.address,
                callData: balancerMulticall.methods
                  .getPoolInfo(
                    slicedPoolWithTokensAddresses,
                    totalTokensInPools,
                  )
                  .encodeABI(),
              },
            ],
            blockNumber,
          );
          _blockNumber = result.blockNumber;
          return result.results.map(r =>
            defaultAbiCoder
              .decode(['uint256[]'], r.returnData)[0]
              .map((v: BigNumber) => v.toBigInt()),
          );
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

  assert(_blockNumber !== undefined, 'blockNumber is undefined');

  return { blockNumber: _blockNumber, state: ret };
}
