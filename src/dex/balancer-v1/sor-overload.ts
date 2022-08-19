import { Contract } from 'web3-eth-contract';
import { PoolTypes } from '@balancer-labs/sor/dist/index';
import BigNumber from 'bignumber.js';
import { PoolStateAsString } from './types';

// Has almost the same logic as getAllPoolDataOnChain
// Modifies the balance of pools according to the on chain state
// at a certain blockNumber
export async function updatePoolState(
  pools: PoolStateAsString[], // Warning the token balances of pools are modified
  balancerMulti: Contract,
  blockNumber: number,
): Promise<void> {
  if (pools.length === 0) throw Error('There are no pools.');

  const addresses: string[][] = [];
  let total = 0;

  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];

    addresses.push([pool.id]);
    total++;
    pool.tokens.forEach(token => {
      addresses[i].push(token.address);
      total++;
    });
  }

  const results = await balancerMulti.methods
    .getPoolInfo(addresses, total)
    .call({}, blockNumber);

  let j = 0;
  for (let i = 0; i < pools.length; i++) {
    pools[i].tokens.forEach(token => {
      token.balance = results[j];
      j++;
    });
  }
}
