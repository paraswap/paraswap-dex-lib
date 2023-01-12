import { BI_POWS } from '../../bigint-constants';

const WAD = BI_POWS[18];

function wmul(x: bigint, y: bigint): bigint {
  return (x * y + WAD / 2n) / WAD;
}

function wdiv(x: bigint, y: bigint): bigint {
  return (x * WAD + y / 2n) / y;
}

// Babylonian Method for solving sqrt
function sqrt(y: bigint): bigint {
  let z = 0n;
  if (y > 3) {
    let z = y;
    let x = y / 2n + 1n;
    while (x < z) {
      z = x;
      x = (y / x + x) / 2n;
    }
  } else if (y != 0n) {
    z = 1n;
  }
  return z;
}

function solveQuad(b: bigint, c: bigint): bigint {
  return (sqrt(b * b + c * 4n * WAD) - b) / 2n;
}

function swapQuoteFunc(
  assetX: bigint,
  assetY: bigint,
  liabilityX: bigint,
  liabilityY: bigint,
  dX: bigint,
  a: bigint,
): bigint {
  if (liabilityX == 0n || liabilityY == 0n) {
    // in case div of 0, CORE_UNDERFLOW
    return 0n;
  }
  // int256 D = Ax + Ay - A.wmul((Lx * Lx) / Ax + (Ly * Ly) / Ay); // flattened _invariantFunc
  const d =
    assetX +
    assetY -
    wmul(
      a,
      (liabilityX * liabilityX) / assetX + (liabilityY * liabilityY) / assetY,
    );
  // int256 rx_ = (Ax + Dx).wdiv(Lx);
  const rX = wdiv(assetX + dX, liabilityX);
  // int256 b = (Lx * (rx_ - A.wdiv(rx_))) / Ly - D.wdiv(Ly); // flattened _coefficientFunc
  const b =
    (liabilityX * (rX - wdiv(a, rX))) / liabilityY - wdiv(d, liabilityY);
  // int256 ry_ = _solveQuad(b, A);
  const rY = solveQuad(b, a);
  // int256 Dy = Ly.wmul(ry_) - Ay;
  const dY = wmul(liabilityY, rY) - assetY;
  // if (Dy < 0) {
  //     quote = uint256(-Dy);
  // } else {
  //     quote = uint256(Dy);
  // }
  if (dY < 0n) {
    return -dY;
  } else {
    return dY;
  }
}

export function quoteFrom(
  assetX: bigint,
  assetY: bigint,
  liabilityX: bigint,
  liabilityY: bigint,
  fromAmount: bigint,
  ampFactor: bigint,
  haircutRate: bigint,
): bigint {
  const idealToAmount = swapQuoteFunc(
    assetX,
    assetY,
    liabilityX,
    liabilityY,
    fromAmount,
    ampFactor,
  );
  if (fromAmount > 0n && assetY < idealToAmount) {
    return 0n;
  }
  const haircut = wmul(idealToAmount, haircutRate);
  const actualToAmount = idealToAmount - haircut;
  return actualToAmount;
}
