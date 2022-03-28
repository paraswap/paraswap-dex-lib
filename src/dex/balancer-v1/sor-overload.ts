import * as bmath from '@balancer-labs/sor/dist/bmath';
import { Pool as OldPool } from '@balancer-labs/sor/dist/types';
import { PoolState } from './types';

// Original Implementation: https://github.com/balancer-labs/balancer-sor/blob/v1.0.0-1/src/helpers.ts
// No change has been made. This function doesn't exist in older SOR and is needed to convert the new SOR Pool
// to the older SOR Pool. The new SOR has the datatype PoolPairData which is equivalent to old SOR datatype
// Pool.
export function parsePoolPairData(
  p: PoolState,
  tokenIn: string,
  tokenOut: string,
): OldPool | null {
  let tI = p.tokens.find(
    t => t.address.toLowerCase() === tokenIn.toLowerCase(),
  );
  let tO = p.tokens.find(
    t => t.address.toLowerCase() === tokenOut.toLowerCase(),
  );

  if (!tI || !tO) return null;

  let poolPairData = {
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
