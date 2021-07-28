import { JsonRpcProvider } from '@ethersproject/providers';
import { Address } from '../types';
import { Curve } from './curve';
import { DexMap, IDex } from './idex';
import { UniswapV2 } from './uniswap-v2';

const dexes = [
  UniswapV2, 
  Curve
];

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
      dexObj.getDEXKey().forEach(dexKey => { // temp: move to findDexByKey instead
        acc[dexKey] = dexObj;
      })
      return acc;
    },
    {},
  );
}
