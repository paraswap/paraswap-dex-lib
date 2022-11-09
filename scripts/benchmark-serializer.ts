import _ from 'lodash';
import { readFileSync } from 'fs';
import BigNumber from 'bignumber.js';

import { stringifyAsync, parseAsync } from 'yieldable-json';
import { stringifyAsync as stringifyAsync2 } from 'js-coroutines';

export const bigIntify = (val: any) => BigInt(val);

export const bigNumberify = (val: any) => new BigNumber(val);

export const stringify = (val: any) => val.toString();

const PREFIX_BIG_INT = 'bi@';
const PREFIX_BIG_NUMBER = 'bn@';

const stringCheckerBuilder = (prefix: string) => {
  return (obj: any) => {
    if (!_.isString(obj)) {
      return false;
    }
    for (let i = 0; i < prefix.length; ++i) {
      if (prefix[i] !== obj[i]) {
        return false;
      }
    }
    return true;
  };
};

const checkerStringWithBigIntPrefix = stringCheckerBuilder(PREFIX_BIG_INT);
const checkerStringWithBigNumberPrefix =
  stringCheckerBuilder(PREFIX_BIG_NUMBER);

const casterToStringbuilder = (prefix: string, obj: any) =>
  prefix.concat(obj.toString());

const casterBigIntToString = (obj: BigInt) =>
  casterToStringbuilder(PREFIX_BIG_INT, obj);
const casterBigNumberToString = (obj: BigNumber) =>
  casterToStringbuilder(PREFIX_BIG_NUMBER, obj);

const checkerBigInt = (obj: any) => typeof obj === 'bigint';
const checkerBigNumber = (obj: any) => obj instanceof BigNumber;

const stringCasterBuilder = (
  prefix: string,
  constructor: (str: string) => any,
) => {
  return (obj: string) => {
    return constructor(obj.slice(prefix.length));
  };
};

const casterStringToBigInt = stringCasterBuilder(
  PREFIX_BIG_INT,
  (str: string) => BigInt(str),
);

const casterStringToBigNumber = stringCasterBuilder(
  PREFIX_BIG_NUMBER,
  (str: string) => new BigNumber(str),
);
type TypeSerializer = {
  checker: (obj: any) => boolean;
  caster: (obj: any) => any;
};

export function deepTypecast(obj: any, types: TypeSerializer[]): any {
  return _.forEach(obj, (val: any, key: any, obj: any) => {
    for (const type of types) {
      if (type.checker(val)) {
        const cast = type.caster(val);
        obj[key] = cast;
        return;
      }
    }
    const isObject = _.isObject(val);
    if (isObject) {
      deepTypecast(val, types);
    } else {
      obj[key] = val;
    }
  });
}

export function deepTypecast2(types: TypeSerializer[]): any {
  return (key: string, val: any) => {
    for (const type of types) {
      if (type.checker(val)) {
        return type.caster(val);
      }
    }
    return val;
  };
}

export class Utils {
  static Serialize(data: any): Promise<string> {
    return new Promise(resolve => {
      stringifyAsync(
        deepTypecast(_.cloneDeep(data), [
          {
            checker: checkerBigInt,
            caster: casterBigIntToString,
          },
          {
            checker: checkerBigNumber,
            caster: casterBigNumberToString,
          },
        ]),
        (err, res) => {
          resolve(res);
        },
      );
    });
  }

  static Serialize2(data: any): string {
    return JSON.stringify(
      data,
      deepTypecast2([
        {
          checker: checkerBigInt,
          caster: casterBigIntToString,
        },
        {
          checker: checkerBigNumber,
          caster: casterBigNumberToString,
        },
      ]),
    );
  }

  static async Serialize3(data: any): Promise<string> {
    const bo = await stringifyAsync2(
      deepTypecast(_.cloneDeep(data), [
        {
          checker: checkerBigInt,
          caster: casterBigIntToString,
        },
        {
          checker: checkerBigNumber,
          caster: casterBigNumberToString,
        },
      ]),
    );

    return bo.toString();
  }

  static Parse(data: any): any {
    return deepTypecast(JSON.parse(data), [
      {
        checker: checkerStringWithBigIntPrefix,
        caster: casterStringToBigInt,
      },
      {
        checker: checkerStringWithBigNumberPrefix,
        caster: casterStringToBigNumber,
      },
    ]);
  }

  static Parse2(data: any): any {
    return JSON.parse(
      data,
      deepTypecast2([
        {
          checker: checkerStringWithBigIntPrefix,
          caster: casterStringToBigInt,
        },
        {
          checker: checkerStringWithBigNumberPrefix,
          caster: casterStringToBigNumber,
        },
      ]),
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

const getTimeInNanoSeconds = () => {
  const hrTime = process.hrtime();
  return hrTime[0] * 1000000000 + hrTime[1];
};

const data = readFileSync(process.argv[2]);

const parsing: number[] = [];
const parsing2: number[] = [];

const serialize: number[] = [];
const serialize2: number[] = [];
const serialize3: number[] = [];

const main = async () => {
  let now = getTimeInNanoSeconds();
  for (let i = 0; i < 1000; ++i) {
    now = getTimeInNanoSeconds();
    const parsed = Utils.Parse(data);
    let res = getTimeInNanoSeconds();
    parsing.push(res - now);
    // console.log('Parsing   ', res - now);

    now = getTimeInNanoSeconds();
    const parsed2 = Utils.Parse2(data);
    res = getTimeInNanoSeconds();
    parsing2.push(res - now);

    now = getTimeInNanoSeconds();
    await Utils.Serialize(parsed);
    res = getTimeInNanoSeconds();
    serialize.push(res - now);
    // console.log('Serialize ', res - now);

    now = getTimeInNanoSeconds();
    Utils.Serialize2(parsed);
    res = getTimeInNanoSeconds();
    serialize2.push(res - now);
    // console.log('Serialize2', res - now);
    //
    now = getTimeInNanoSeconds();
    Utils.Serialize3(parsed);
    res = getTimeInNanoSeconds();
    serialize3.push(res - now);
  }

  console.log('parsing 1\t\t', _.mean(parsing));
  console.log('parsing 2\t\t', _.mean(parsing2));
  console.log('Serializing 1\t\t', _.mean(serialize));
  console.log('Serializing 2\t\t', _.mean(serialize2));
  console.log('Serializing 3\t\t', _.mean(serialize3));
};

main();
