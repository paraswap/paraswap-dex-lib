import { ETHER_ADDRESS, Network, SwapSide, MAX_UINT } from './constants';
import { BI_MAX_UINT256, BI_POWS } from './bigint-constants';
import { DexConfigMap } from './types';
import _ from 'lodash';
import BigNumber from 'bignumber.js';
import { Logger } from './types';

export const isETHAddress = (address: string) =>
  address.toLowerCase() === ETHER_ADDRESS.toLowerCase();

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

const casterBigIntToString = (obj: bigint) => 'bi@'.concat(obj.toString());
const checkerBigInt = (obj: any) => typeof obj === 'bigint';

const checkerStringWithBigIntPrefix = (obj: any) =>
  _.isString(obj) && obj.includes('bi@');
const casterStringToBigInt = (obj: string) => BigInt(obj.slice(3));

export function deepTypecast<T>(
  obj: any,
  checker: (val: any) => boolean,
  caster: (val: T) => any,
): any {
  return _.forEach(obj, (val: any, key: any, obj: any) => {
    const checked = checker(val);

    if (checked) {
      const cast = caster(val);
      obj[key] = cast;
    } else {
      const isObject = _.isObject(val);
      if (isObject) {
        deepTypecast(val, checker, caster);
      } else {
        obj[key] = val;
      }
    }
  });
}

export class Utils {
  static Serialize(data: any): string {
    return JSON.stringify(
      deepTypecast<bigint>(
        _.cloneDeep(data),
        checkerBigInt,
        casterBigIntToString,
      ),
    );
  }

  static Parse(data: any): any {
    return deepTypecast<string>(
      _.cloneDeep(JSON.parse(data)),
      checkerStringWithBigIntPrefix,
      casterStringToBigInt,
    );
  }

  static timeoutPromise<T>(
    promise: Promise<T>,
    timeout: number,
    message: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((resolve, reject) => {
        setTimeout(() => reject(message), timeout);
      }),
    ]);
  }
}

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

export function _require(
  b: boolean,
  message: string,
  values?: Record<string, unknown>,
  condition?: string,
): void {
  let receivedValues = '';
  if (values && condition) {
    const keyValueStr = Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    receivedValues = `Values: ${keyValueStr}. Condition: ${condition} violated`;
  }
  if (!b)
    throw new Error(
      `${receivedValues}. Error message: ${message ? message : 'undefined'}`,
    );
}

export const bigIntify = (val: any) => BigInt(val);

export const bignumberify = (val: any) => new BigNumber(val);

export const stringify = (val: any) => val.toString();

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
        : BI_MAX_UINT256;
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

interface SliceCallsInput<T, U> {
  inputArray: T[];
  execute: (inputSlice: T[], sliceIndex: number) => U;
  sliceLength: number;
}

// author: @velenir. source: https://github.com/paraswap/paraswap-volume-tracker/blob/ceaf5e267c9720b190b19c17465b438f57f41851/src/lib/utils/helpers.ts#L20
export function sliceCalls<T, U>({
  inputArray,
  execute,
  sliceLength,
}: SliceCallsInput<T, U>): [U, ...U[]] {
  if (sliceLength >= inputArray.length) return [execute(inputArray, 0)];
  const results: U[] = [];

  for (
    let i = 0, sliceIndex = 0;
    i < inputArray.length;
    i += sliceLength, ++sliceIndex
  ) {
    const inputSlice = inputArray.slice(i, i + sliceLength);
    const resultOfSlice = execute(inputSlice, sliceIndex);
    results.push(resultOfSlice);
  }

  return results as [U, ...U[]];
}

export const catchParseLogError = (e: any, logger: Logger) => {
  if (e instanceof Error) {
    if (!e.message.includes('no matching event')) {
      logger.error('Failed parse event', e);
    }
  }
};
