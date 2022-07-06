import { DexConfigMap } from '../../types';
import { DexParams } from './types';

export function getUniswapV3DexKey(UniswapV3Config: DexConfigMap<DexParams>) {
  const UniswapV3Keys = Object.keys(UniswapV3Config);
  if (UniswapV3Keys.length !== 1) {
    throw new Error(
      `UniswapV3 key in UniswapV3Config is not unique. Update relevant places (optimizer) or fix config issue. Received: ${JSON.stringify(
        UniswapV3Config,
        (_0, value) => (typeof value === 'bigint' ? value.toString() : value),
      )}`,
    );
  }

  return UniswapV3Keys[0].toLowerCase();
}

export function setImmediatePromise() {
  return new Promise<void>(resolve => {
    setImmediate(() => {
      resolve();
    });
  });
}
