import { JsonRpcProvider } from '@ethersproject/providers';
import { Address } from '../types';
import { Curve } from './curve';
import { CurveV2 } from './curve-v2';
import { DexMap, IDex } from './idex';
import { StablePool } from './stable-pool';
import { UniswapV2 } from './uniswap-v2';
import { ZeroX } from './zerox';

const dexes = [UniswapV2, Curve, CurveV2, StablePool, ZeroX];

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
      dexObj.getDEXKey().forEach(dexKey => {
        // temp: move to findDexByKey instead
        acc[dexKey] = dexObj;
      });
      return acc;
    },
    {},
  );
}
