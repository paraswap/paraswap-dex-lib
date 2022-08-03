import { ETHER_ADDRESS, Network, SwapSide, MAX_UINT } from './constants';
import { BI_POWS } from './bigint-constants';
import { DexConfigMap } from './types';

export const isETHAddress = (address: string) =>
  address.toLowerCase() === ETHER_ADDRESS.toLowerCase();

const ZERO_UINT = BigInt('0');

export const prependWithOx = (str: string) =>
  str.startsWith('0x') ? str : '0x' + str;

export const uuidToBytes16 = (uuid: string) => '0x' + uuid.replace(/-/g, '');

// This function guarantees that the distribution adds up to exactly 100% by
// applying rounding in the other direction for numbers with the most error.
export function convertToBasisPoints(dist: number[]): number[] {
  const BPS = 10000;
  const sumDist = dist.reduce((a, b) => a + b, 0);
  const basisPoints = dist.map(n => (n * BPS) / sumDist);
  const rounded = basisPoints.map(n => Math.round(n));
  const sumRounded = rounded.reduce((a, b) => a + b, 0);
  if (sumRounded === BPS) {
    return rounded;
  }
  const errors = basisPoints.map((n, i) => ({
    error: rounded[i] - n,
    index: i,
  }));
  if (sumRounded < BPS) {
    errors.sort((a, b) => a.error - b.error);
    for (let i = 0; i < BPS - sumRounded; ++i) {
      ++rounded[errors[i].index];
    }
  } else {
    errors.sort((a, b) => b.error - a.error);
    for (let i = 0; i < sumRounded - BPS; ++i) {
      --rounded[errors[i].index];
    }
  }
  return rounded;
}

export function getDexKeysWithNetwork<T>(
  dexConfig: DexConfigMap<T>,
): { key: string; networks: Network[] }[] {
  return Object.entries(dexConfig).map(([dKey, dValue]) => ({
    key: dKey,
    networks: Object.keys(dValue).map(n => parseInt(n)),
  }));
}

// We assume that the rate always gets worse when be go bigger in volume.
// Both oldVolume and newVolume are sorted
// Considering these assumption, whenever we don't have a price we consider
// the price for the next volume price available and interpolate linearly.
// Interpolate can be useful in two cases
// -> you have a smaller chunked prices and you want go to a higher chunked prices
// -> you have a linear prices and you want go to a not skewed prices
// -> could be used by the order book exchanges as an orderbook works almost with the same principles.
// p = p[i-1] + (p[i] - p[i-1])/(q[i]-q[i-1])*(v-q[i-1])
export function interpolate(
  oldVolume: bigint[],
  oldPrices: bigint[],
  newVolume: bigint[],
  side: SwapSide,
): bigint[] {
  let maxPrice = oldPrices[0];
  let isValid = [true];
  for (let p of oldPrices.slice(1)) {
    if (p >= maxPrice) {
      maxPrice = p;
      isValid.push(true);
    } else {
      isValid.push(false);
    }
  }

  let i = 0;
  return newVolume.map(v => {
    if (v === ZERO_UINT) return ZERO_UINT;

    while (i < oldVolume.length && v > oldVolume[i]) i++;

    // if we dont have any more prices for a bigger volume return last price for sell and infinity for buy
    if (i >= oldVolume.length) {
      return !isValid[oldPrices.length - 1]
        ? ZERO_UINT
        : side === SwapSide.SELL
        ? oldPrices[oldPrices.length - 1]
        : BigInt(MAX_UINT);
    }

    if (!isValid[i]) return ZERO_UINT;

    // if the current volume is equal to oldVolume then just use that
    if (oldVolume[i] === v) return oldPrices[i];

    if (i > 0 && !isValid[i - 1]) return ZERO_UINT;

    // As we know that derivative of the prices can't go up we apply a linear interpolation
    const lastOldVolume = i > 0 ? oldVolume[i - 1] : ZERO_UINT;
    const lastOldPrice = i > 0 ? oldPrices[i - 1] : ZERO_UINT;

    // Old code - this doesn't work because slope can be very small and gets
    // rounded badly in bignumber.js, so need to do the division later
    //const slope = oldPrices[i]
    //  .minus(lastOldPrice)
    //  .div(oldVolume[i].minus(lastOldVolume));
    //return lastOldPrice.plus(slope.times(v.minus(lastOldVolume)));

    return (
      lastOldPrice +
      ((oldPrices[i] - lastOldPrice) * (v - lastOldVolume)) /
        (oldVolume[i] - lastOldVolume)
    );
  });
}

export function biginterify(val: any) {
  return BigInt(val);
}
// This is needed in order to not modify existing logic and use this wrapper
// to be safe if we receive not cached decimals
export function getBigIntPow(decimals: number): bigint {
  const value = BI_POWS[decimals];
  // It is not accurate to create 10 ** 23 and more decimals from number type
  return value === undefined ? BigInt(`1${'0'.repeat(decimals)}`) : value;
}

export const _require = (b: boolean, message: string) => {
  if (!b) throw new Error(message);
};
