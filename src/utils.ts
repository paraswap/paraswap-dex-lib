import { BI_POWS } from './bigint-constants';
import { ETHER_ADDRESS, Network } from './constants';
import { Address, Token, DexConfigMap } from './types';
import _ from 'lodash';

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
  return _.forEach(
    obj,
    (val: any, key: any, obj: any) =>
      (obj[key] = checker(val)
        ? caster(val)
        : _.isObject(val)
        ? deepTypecast(val, checker, caster)
        : val),
  );
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

export const stringify = (val: any) => val.toString();
