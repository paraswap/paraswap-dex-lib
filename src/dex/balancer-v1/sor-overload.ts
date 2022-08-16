import * as bmath from '@balancer-labs/sor/dist/bmath';
import { Pool as OldPool } from '@balancer-labs/sor/dist/types';
import type { Contract } from 'web3-eth-contract';
import { biginterify } from '../../utils';
import { PoolState } from './types';

// Has almost the same logic as getAllPoolDataOnChain
// Modifies the balance of pools according to the on chain state
// at a certain blockNumber
export async function updatePoolState(
  pools: PoolState[], // Warning the token balances of pools are modified
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
      token.balance = biginterify(bmath.bnum(results[j]));
      j++;
    });
  }
}

// Original Implementation: https://github.com/balancer-labs/balancer-sor/blob/v1.0.0-1/src/helpers.ts
// No change has been made. This function doesn't exist in older SOR and is needed to convert the new SOR Pool
// to the older SOR Pool. The new SOR has the datatype PoolPairData which is equivalent to old SOR datatype
// Pool.
export function parsePoolPairData(
  p: PoolState,
  tokenIn: string,
  tokenOut: string,
): OldPool | null {
  const tI = p.tokens.find(
    t => t.address.toLowerCase() === tokenIn.toLowerCase(),
  );
  const tO = p.tokens.find(
    t => t.address.toLowerCase() === tokenOut.toLowerCase(),
  );

  if (!tI || !tO) return null;

  const poolPairData = {
    id: p.id,
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    decimalsIn: tI.decimals,
    decimalsOut: tO.decimals,
    balanceIn: bmath.bnum(tI.balance.toString()),
    balanceOut: bmath.bnum(tO.balance.toString()),
    weightIn: bmath.scale(
      bmath
        .bnum(tI.denormWeight.toString())
        .div(bmath.bnum(p.totalWeight.toString())),
      18,
    ),
    weightOut: bmath.scale(
      bmath
        .bnum(tO.denormWeight.toString())
        .div(bmath.bnum(p.totalWeight.toString())),
      18,
    ),
    swapFee: bmath.bnum(p.swapFee.toString()),
  };

  return poolPairData;
}
