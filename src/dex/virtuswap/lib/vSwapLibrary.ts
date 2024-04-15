import { assert } from 'ts-essentials';
import { _require } from '../../../utils';
import { Address } from '../../../types';
import { VirtualPoolTokens, VirtualPoolState, PoolState } from '../types';
import { RESERVE_RATIO_FACTOR, PRICE_FEE_FACTOR } from '../constants';
import { BigIntMath } from './BigIntMath';

export function findCommonToken(
  ikToken0: Address,
  ikToken1: Address,
  jkToken0: Address,
  jkToken1: Address,
): VirtualPoolTokens {
  return ikToken0 === jkToken0
    ? { ik0: ikToken1, ik1: ikToken0, jk0: jkToken1, jk1: jkToken0 }
    : ikToken0 === jkToken1
    ? { ik0: ikToken1, ik1: ikToken0, jk0: jkToken0, jk1: jkToken1 }
    : ikToken1 === jkToken0
    ? { ik0: ikToken0, ik1: ikToken1, jk0: jkToken1, jk1: jkToken0 }
    : { ik0: ikToken0, ik1: ikToken1, jk0: jkToken0, jk1: jkToken1 };
}

export function calculateVPool(
  ikTokenABalance: bigint,
  ikTokenBBalance: bigint,
  jkTokenABalance: bigint,
  jkTokenBBalance: bigint,
): Pick<VirtualPoolState, `balance${0 | 1}`> {
  const balance0 =
    (ikTokenABalance * BigIntMath.min(ikTokenBBalance, jkTokenBBalance)) /
    BigIntMath.max(ikTokenBBalance, 1n);
  const balance1 =
    (jkTokenABalance * BigIntMath.min(ikTokenBBalance, jkTokenBBalance)) /
    BigIntMath.max(jkTokenBBalance, 1n);
  return {
    balance0,
    balance1,
  };
}

export function getAmountIn(
  amountOut: bigint,
  pairBalanceIn: bigint,
  pairBalanceOut: bigint,
  fee: number,
): bigint {
  const numerator = pairBalanceIn * amountOut * PRICE_FEE_FACTOR;
  const denominator = (pairBalanceOut - amountOut) * BigInt(fee);
  return numerator / denominator + 1n;
}

export function getAmountOut(
  amountIn: bigint,
  pairBalanceIn: bigint,
  pairBalanceOut: bigint,
  fee: number,
): bigint {
  const amountInWithFee = amountIn * BigInt(fee);
  const numerator = amountInWithFee * pairBalanceOut;
  const denominator = pairBalanceIn * PRICE_FEE_FACTOR + amountInWithFee;
  return numerator / denominator;
}

export function quote(
  amountA: bigint,
  balanceA: bigint,
  balanceB: bigint,
): bigint {
  _require(
    amountA > 0n,
    'VSWAP: INSUFFICIENT_AMOUNT',
    { amountA },
    'amountA > 0n',
  );
  _require(
    balanceA > 0n && balanceB > 0n,
    'VSWAP: INSUFFICIENT_LIQUIDITY',
    { balanceA, balanceB },
    'balanceA > 0n && balanceB > 0n',
  );
  return (amountA * balanceB) / balanceA;
}

export function sortBalances(
  tokenIn: Address,
  baseToken: Address,
  pairBalance0: bigint,
  pairBalance1: bigint,
): [bigint, bigint] {
  return baseToken === tokenIn
    ? [pairBalance0, pairBalance1]
    : [pairBalance1, pairBalance0];
}

export function getVirtualPool(
  jkPair: PoolState,
  ikPair: PoolState,
  blockNumber: number,
): VirtualPoolState {
  _require(
    blockNumber >= ikPair.lastSwapBlock + ikPair.blocksDelay,
    'VSWAP: LOCKED_VPOOL',
    {
      blockNumber,
      lastSwapBlock: ikPair.lastSwapBlock,
      blocksDelay: ikPair.blocksDelay,
    },
    'blockNumber >= lastSwapBlock + blocksDelay',
  );

  const vPoolTokens = findCommonToken(
    ikPair.token0,
    ikPair.token1,
    jkPair.token0,
    jkPair.token1,
  );

  _require(
    vPoolTokens.ik0 !== vPoolTokens.jk0 && vPoolTokens.ik1 === vPoolTokens.jk1,
    'VSWAP: INVALID_VPOOL',
    {
      ik0: vPoolTokens.ik0,
      jk0: vPoolTokens.jk0,
      ik1: vPoolTokens.ik1,
      jk1: vPoolTokens.jk1,
    },
    'ik0 !== jk0 && ik1 === jk1',
  );

  _require(
    jkPair.reserves[vPoolTokens.ik0] !== undefined,
    'VSWAP: NOT_ALLOWED',
    { ik0: vPoolTokens.ik0, reserves: Object.keys(jkPair.reserves) },
    'reserves.includes(ik0)',
  );

  const ikBalances = sortBalances(
    vPoolTokens.ik0,
    ikPair.token0,
    ikPair.pairBalance0,
    ikPair.pairBalance1,
  );
  const jkBalances = sortBalances(
    vPoolTokens.jk0,
    jkPair.token0,
    jkPair.pairBalance0,
    jkPair.pairBalance1,
  );

  const vPool = calculateVPool(
    ikBalances[0],
    ikBalances[1],
    jkBalances[0],
    jkBalances[1],
  );

  return {
    ...vPool,
    fee: jkPair.vFee,
    token0: vPoolTokens.ik0,
    token1: vPoolTokens.jk0,
    commonToken: vPoolTokens.ik1,
    jkPair,
    ikPair,
  };
}

export function getVirtualPools(
  allPairs: PoolState[],
  blockNumber: number,
  token0: Address,
  token1: Address,
): VirtualPoolState[] {
  const vPools: VirtualPoolState[] = [];
  for (const jkPair of allPairs) {
    const jk0 = jkPair.token0;
    const jk1 = jkPair.token1;
    if (
      (jk0 === token1 || jk1 === token1) &&
      jk0 !== token0 &&
      jk1 !== token0 &&
      jkPair.reserves[token0] !== undefined
    ) {
      const ikPair = allPairs.find(
        pair =>
          (pair.token0 === token0 &&
            pair.token1 === (jk0 === token1 ? jk1 : jk0)) ||
          (pair.token1 === token0 &&
            pair.token0 === (jk0 === token1 ? jk1 : jk0)),
      );
      if (ikPair && blockNumber >= ikPair.lastSwapBlock + ikPair.blocksDelay) {
        vPools.push(getVirtualPool(jkPair, ikPair, blockNumber));
      }
    }
  }
  return vPools;
}

export function getMaxVirtualTradeAmountRtoN(vPool: VirtualPoolState): bigint {
  const fee = BigInt(vPool.fee);
  const balance0 = vPool.jkPair.pairBalance0;
  const balance1 = vPool.jkPair.pairBalance1;
  const vBalance0 = vPool.balance0;
  const vBalance1 = vPool.balance1;
  const reserveRatioFactor = RESERVE_RATIO_FACTOR;
  const priceFeeFactor = PRICE_FEE_FACTOR;
  const maxReserveRatio = vPool.jkPair.maxReserveRatio;
  const reserves = vPool.jkPair.reserves[vPool.token0]?.balance ?? 0n;
  const reservesBaseValueSum =
    vPool.jkPair.reservesBaseValueSum -
    (vPool.jkPair.reserves[vPool.token0]?.baseValue ?? 0n);

  _require(
    balance0 > 0n && balance0 <= 10n ** 32n,
    'invalid balance0',
    { balance0 },
    'balance0 > 0n && balance0 <= 10n ** 32n',
  );
  _require(
    balance1 > 0n && balance1 <= 10n ** 32n,
    'invalid balance1',
    { balance1 },
    'balance1 > 0n && balance1 <= 10n ** 32n',
  );
  _require(
    vBalance0 > 0n && vBalance0 <= 10n ** 32n,
    'invalid vBalance0',
    { vBalance0 },
    'vBalance0 > 0n && vBalance0 <= 10n ** 32n',
  );
  _require(
    vBalance1 > 0n && vBalance1 <= 10n ** 32n,
    'invalid vBalance1',
    { vBalance1 },
    'vBalance1 > 0n && vBalance1 <= 10n ** 32n',
  );
  _require(
    fee > 0n && fee <= priceFeeFactor,
    'invalid fee',
    { fee, priceFeeFactor },
    'fee > 0n && fee <= priceFeeFactor',
  );
  _require(
    maxReserveRatio > 0n && maxReserveRatio <= reserveRatioFactor,
    'invalid maxReserveRatio',
    { maxReserveRatio, reserveRatioFactor },
    'maxReserveRatio > 0n && maxReserveRatio <= reserveRatioFactor',
  );

  // reserves are full, the answer is 0
  if (reservesBaseValueSum > 2n * balance0 * maxReserveRatio) return 0n;

  let maxAmountIn: bigint;
  if (vPool.jkPair.token0 === vPool.token1) {
    _require(
      vBalance1 <= balance0,
      'invalid vBalance1',
      { vBalance1, balance0 },
      'vBalance1 <= balance0',
    );
    const a = vBalance1 * reserveRatioFactor;
    const b =
      vBalance0 *
        (-2n * balance0 * maxReserveRatio +
          vBalance1 *
            (2n * maxReserveRatio +
              (priceFeeFactor * reserveRatioFactor) / fee) +
          reserveRatioFactor * reservesBaseValueSum) +
      reserves * reserveRatioFactor * vBalance1;
    const c1 = (priceFeeFactor * vBalance0) / fee;
    const c2 =
      2n * balance0 * maxReserveRatio * vBalance0 -
      reserveRatioFactor *
        (reserves * vBalance1 + reservesBaseValueSum * vBalance0);

    const [negativeC, uc2] = c2 < 0 ? [false, -c2] : [true, c2];

    maxAmountIn = vBalance0;

    // Newton's method
    for (let i = 0; i < 7; i++) {
      const derivative = 2n * a * maxAmountIn + b;

      const [negativeDerivative, uDerivative] =
        derivative < 0 ? [true, -derivative] : [false, derivative];

      maxAmountIn = negativeC
        ? BigIntMath.mulDiv(a, BigInt(maxAmountIn * maxAmountIn), uDerivative) +
          BigIntMath.mulDiv(c1, uc2, uDerivative)
        : BigIntMath.mulDiv(a, BigInt(maxAmountIn * maxAmountIn), uDerivative) -
          BigIntMath.mulDiv(c1, uc2, uDerivative);

      if (negativeDerivative) maxAmountIn = -maxAmountIn;
    }
  } else {
    _require(
      vBalance1 <= balance1,
      'invalid vBalance1',
      { vBalance1, balance1 },
      'vBalance1 <= balance1',
    );
    maxAmountIn =
      BigIntMath.mulDiv(
        balance1 * vBalance0,
        2n * balance0 * maxReserveRatio -
          reserveRatioFactor * reservesBaseValueSum,
        balance0 * reserveRatioFactor * vBalance1,
      ) - reserves;
  }
  assert(maxAmountIn >= 0n);
  return maxAmountIn;
}
