import { JsonRpcProvider } from '@ethersproject/providers';
import { Address } from '../types';
import { Curve } from './curve';
import { CurveV2 } from './curve-v2';
import { DexMap, IDex } from './idex';
import { StablePool } from './stable-pool';
import { UniswapV2 } from './uniswap-v2';
import { UniswapV2Fork } from './uniswap-v2-fork';
// import { ZeroX } from './zerox';

const dexes = [UniswapV2, Curve, CurveV2, StablePool, UniswapV2Fork];

export function getDexMap(
  augustusAddress: Address,
  network: number,
  provider: JsonRpcProvider,
): DexMap {
  return dexes.reduce(
    (
      acc: DexMap,
      dex: new (
        augustusAddress: Address,
        network: number,
        provider: JsonRpcProvider,
      ) => IDex<any, any>,
    ) => {
      const dexObj = new dex(augustusAddress, network, provider);
      dexObj.getDEXKeys().forEach(dexKeys => {
        // temp: move to findDexByKey instead
        acc[dexKeys] = dexObj;
      });
      return acc;
    },
    {},
  );
}
