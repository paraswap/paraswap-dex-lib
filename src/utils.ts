import { SwapSide } from 'paraswap-core';
import { BI_MAX_UINT, BI_POWS } from './bigint-constants';
import { ETHER_ADDRESS, Network } from './constants';
import { Address, Token, DexConfigMap } from './types';

export const WethMap: { [network: number]: Address } = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  3: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
  4: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
  42: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
  56: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  43114: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  250: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
};

export const isETHAddress = (address: string) =>
  address.toLowerCase() === ETHER_ADDRESS.toLowerCase();

export const isWETH = (address: Address, network = 1) =>
  WethMap[network].toLowerCase() === address.toLowerCase();

export const wrapETH = (token: Token, network: number): Token =>
  isETHAddress(token.address) && WethMap[network]
    ? { address: WethMap[network], decimals: 18 }
    : token;

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
    if (v === 0n) return 0n;

    while (i < oldVolume.length && v > oldVolume[i]) i++;

    // if we dont have any more prices for a bigger volume return last price for sell and infinity for buy
    if (i >= oldVolume.length) {
      return !isValid[oldPrices.length - 1]
        ? 0n
        : side === SwapSide.SELL
        ? oldPrices[oldPrices.length - 1]
        : BI_MAX_UINT;
    }

    if (!isValid[i]) return 0n;

    // if the current volume is equal to oldVolume then just use that
    if (oldVolume[i] === v) return oldPrices[i];

    if (i > 0 && !isValid[i - 1]) return 0n;

    // As we know that derivative of the prices can't go up we apply a linear interpolation
    const lastOldVolume = i > 0 ? oldVolume[i - 1] : 0n;
    const lastOldPrice = i > 0 ? oldPrices[i - 1] : 0n;

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

// This is needed in order to not modify existing logic and use this wrapper
// to be safe if we receive not cached decimals
export function getBigIntPow(decimals: number): bigint {
  const value = BI_POWS[decimals];
  // It is not accurate to create 10 ** 23 and more decimals from number type
  return value === undefined ? BigInt(`1${'0'.repeat(decimals)}`) : value;
}
