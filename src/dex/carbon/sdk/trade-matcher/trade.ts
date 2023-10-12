import { ONE, Decimal, BigNumber, BigNumberMax } from '../utils/numerics';
import { EncodedOrder, DecodedOrder } from '../common/types';
import { decodeFloat } from '../utils/encoders';

const C = BigNumber.from(ONE);

const MAX_UINT128 = BigNumber.from(2).pow(128).sub(1);
const MAX_UINT256 = BigNumber.from(2).pow(256).sub(1);

function check(val: BigNumber, max: BigNumber) {
  if (val.gte(0) && val.lte(max)) {
    return val;
  }
  throw null;
}

const uint128 = (n: BigNumber) => check(n, MAX_UINT128);
const add = (a: BigNumber, b: BigNumber) => check(a.add(b), MAX_UINT256);
const sub = (a: BigNumber, b: BigNumber) => check(a.sub(b), MAX_UINT256);
const mul = (a: BigNumber, b: BigNumber) => check(a.mul(b), MAX_UINT256);
const mulDivF = (a: BigNumber, b: BigNumber, c: BigNumber) =>
  check(a.mul(b).div(c), MAX_UINT256);
const mulDivC = (a: BigNumber, b: BigNumber, c: BigNumber) =>
  check(a.mul(b).add(c).sub(1).div(c), MAX_UINT256);

//
//       x * (A * y + B * z) ^ 2
//  ---------------------------------
//   A * x * (A * y + B * z) + z ^ 2
//
const getEncodedTradeBySourceAmount = (
  x: BigNumber,
  y: BigNumber,
  z: BigNumber,
  A: BigNumber,
  B: BigNumber,
): BigNumber => {
  if (A.eq(0)) {
    return mulDivF(x, mul(B, B), mul(C, C));
  }

  const temp1 = mul(z, C);
  const temp2 = add(mul(y, A), mul(z, B));
  const temp3 = mul(temp2, x);

  const factor1 = mulDivC(temp1, temp1, MAX_UINT256);
  const factor2 = mulDivC(temp3, A, MAX_UINT256);
  const factor = BigNumberMax(factor1, factor2);

  const temp4 = mulDivC(temp1, temp1, factor);
  const temp5 = mulDivC(temp3, A, factor);
  return mulDivF(temp2, temp3.div(factor), add(temp4, temp5));
};

//
//                   x * z ^ 2
//  -------------------------------------------
//   (A * y + B * z) * (A * y + B * z - A * x)
//
const getEncodedTradeByTargetAmount = (
  x: BigNumber,
  y: BigNumber,
  z: BigNumber,
  A: BigNumber,
  B: BigNumber,
): BigNumber => {
  if (A.eq(0)) {
    return mulDivC(x, mul(C, C), mul(B, B));
  }

  const temp1 = mul(z, C);
  const temp2 = add(mul(y, A), mul(z, B));
  const temp3 = sub(temp2, mul(x, A));

  const factor1 = mulDivC(temp1, temp1, MAX_UINT256);
  const factor2 = mulDivC(temp2, temp3, MAX_UINT256);
  const factor = BigNumberMax(factor1, factor2);

  const temp4 = mulDivC(temp1, temp1, factor);
  const temp5 = mulDivF(temp2, temp3, factor);
  return mulDivC(x, temp4, temp5);
};

//
//      M * M * x * y
//  ---------------------
//   M * (M - L) * x + y
//
const getDecodedTradeBySourceAmount = (
  x: Decimal,
  y: Decimal,
  L: Decimal,
  M: Decimal,
): Decimal => {
  const n = M.mul(M).mul(x).mul(y);
  const d = M.mul(M.sub(L)).mul(x).add(y);
  return n.div(d);
};

//
//              x * y
//  -----------------------------
//   M * (L - M) * x + M * M * y
//
const getDecodedTradeByTargetAmount = (
  x: Decimal,
  y: Decimal,
  L: Decimal,
  M: Decimal,
): Decimal => {
  const n = x.mul(y);
  const d = M.mul(L.sub(M)).mul(x).add(M.mul(M).mul(y));
  return n.div(d);
};

export const getEncodedTradeTargetAmount = (
  amount: BigNumber,
  order: EncodedOrder,
): BigNumber => {
  const x = amount;
  const y = order.y;
  const z = order.z;
  const A = decodeFloat(order.A);
  const B = decodeFloat(order.B);
  try {
    return uint128(getEncodedTradeBySourceAmount(x, y, z, A, B));
  } catch (error) {
    return BigNumber.from(0); /* rate = zero / amount = zero */
  }
};

export const getEncodedTradeSourceAmount = (
  amount: BigNumber,
  order: EncodedOrder,
): BigNumber => {
  const x = amount;
  const y = order.y;
  const z = order.z;
  const A = decodeFloat(order.A);
  const B = decodeFloat(order.B);
  try {
    return uint128(getEncodedTradeByTargetAmount(x, y, z, A, B));
  } catch (error) {
    return MAX_UINT128; /* rate = amount / infinity = zero */
  }
};

export const getDecodedTradeTargetAmount = (
  amount: Decimal,
  order: DecodedOrder,
): Decimal => {
  const x = amount;
  const y = new Decimal(order.liquidity);
  const L = new Decimal(order.lowestRate).sqrt();
  const M = new Decimal(order.marginalRate).sqrt();
  return getDecodedTradeBySourceAmount(x, y, L, M);
};

export const getDecodedTradeSourceAmount = (
  amount: Decimal,
  order: DecodedOrder,
): Decimal => {
  const x = amount;
  const y = new Decimal(order.liquidity);
  const L = new Decimal(order.lowestRate).sqrt();
  const M = new Decimal(order.marginalRate).sqrt();
  return getDecodedTradeByTargetAmount(x, y, L, M);
};
