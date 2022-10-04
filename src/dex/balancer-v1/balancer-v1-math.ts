import { _require, getBigIntPow } from '../../utils';

const BONE = getBigIntPow(18);

const MIN_BPOW_BASE = 1n;
const MAX_BPOW_BASE = 2n * BONE - 1n;
const BPOW_PRECISION = BONE / getBigIntPow(10);

// These functions are slightly rewritten since overflow not possible
// when using bigints (as opposed to Solidity uint256)

function btoi(a: bigint): bigint {
  return a / BONE;
}

function bfloor(a: bigint): bigint {
  return btoi(a) * BONE;
}

function badd(a: bigint, b: bigint): bigint {
  return a + b;
}

function bsub(a: bigint, b: bigint): bigint {
  const [c, flag] = bsubSign(a, b);
  _require(!flag, 'ERR_SUB_UNDERFLOW', { flag }, '!flag');
  return c;
}

function bsubSign(a: bigint, b: bigint): [bigint, boolean] {
  if (a >= b) {
    return [a - b, false];
  } else {
    return [b - a, true];
  }
}

function bmul(a: bigint, b: bigint): bigint {
  const c0 = a * b;
  const c1 = c0 + BONE / 2n;
  const c2 = c1 / BONE;
  return c2;
}

function bdiv(a: bigint, b: bigint): bigint {
  _require(b !== 0n, 'ERR_DIV_ZERO', { b }, 'b !== 0n');
  const c0 = a * BONE;
  const c1 = c0 + b / 2n;
  const c2 = c1 / b;
  return c2;
}

function bpowi(a: bigint, n: bigint): bigint {
  let z = n % 2n !== 0n ? a : BONE;

  for (n /= 2n; n !== 0n; n /= 2n) {
    a = bmul(a, a);

    if (n % 2n !== 0n) {
      z = bmul(z, a);
    }
  }

  return z;
}

function bpow(base: bigint, exp: bigint): bigint {
  _require(
    base >= MIN_BPOW_BASE,
    'ERR_BPOW_BASE_TOO_LOW',
    { base },
    'base >= MIN_BPOW_BASE',
  );
  _require(
    base <= MAX_BPOW_BASE,
    'ERR_BPOW_BASE_TOO_HIGH',
    { base },
    'base <= MAX_BPOW_BASE',
  );

  const whole = bfloor(exp);
  const remain = bsub(exp, whole);

  const wholePow = bpowi(base, btoi(whole));

  if (remain === 0n) {
    return wholePow;
  }

  const partialResult = bpowApprox(base, remain, BPOW_PRECISION);
  return bmul(wholePow, partialResult);
}

function bpowApprox(base: bigint, exp: bigint, precision: bigint): bigint {
  const a = exp;
  const [x, xneg] = bsubSign(base, BONE);
  let term = BONE;
  let sum = term;
  let negative = false;

  for (let i = 1n; term >= precision; ++i) {
    const bigK = i * BONE;
    const [c, cneg] = bsubSign(a, bsub(bigK, BONE));
    term = bmul(term, bmul(c, x));
    term = bdiv(term, bigK);
    if (term === 0n) break;

    if (xneg) negative = !negative;
    if (cneg) negative = !negative;
    if (negative) {
      sum = bsub(sum, term);
    } else {
      sum = badd(sum, term);
    }
  }

  return sum;
}

export function calcOutGivenIn(
  tokenBalanceIn: bigint,
  tokenWeightIn: bigint,
  tokenBalanceOut: bigint,
  tokenWeightOut: bigint,
  tokenAmountIn: bigint,
  swapFee: bigint,
): bigint {
  const weightRatio = bdiv(tokenWeightIn, tokenWeightOut);
  let adjustedIn = bsub(BONE, swapFee);
  adjustedIn = bmul(tokenAmountIn, adjustedIn);
  const y = bdiv(tokenBalanceIn, badd(tokenBalanceIn, adjustedIn));
  const foo = bpow(y, weightRatio);
  const bar = bsub(BONE, foo);
  const tokenAmountOut = bmul(tokenBalanceOut, bar);
  return tokenAmountOut;
}

export function calcInGivenOut(
  tokenBalanceIn: bigint,
  tokenWeightIn: bigint,
  tokenBalanceOut: bigint,
  tokenWeightOut: bigint,
  tokenAmountOut: bigint,
  swapFee: bigint,
): bigint {
  const weightRatio = bdiv(tokenWeightOut, tokenWeightIn);
  const diff = bsub(tokenBalanceOut, tokenAmountOut);
  const y = bdiv(tokenBalanceOut, diff);
  let foo = bpow(y, weightRatio);
  foo = bsub(foo, BONE);
  let tokenAmountIn = bsub(BONE, swapFee);
  tokenAmountIn = bdiv(bmul(tokenBalanceIn, foo), tokenAmountIn);
  return tokenAmountIn;
}
