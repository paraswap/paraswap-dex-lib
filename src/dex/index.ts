import { Address } from '../types';
import { DexMap, IDex } from './idex';
import { UniswapV2 } from './uniswap-v2';

export function getDexMap(augustusAddress: Address): DexMap {
  const dexes = [UniswapV2];
  return dexes.reduce((acc: DexMap, dex: new (augustusAddress: Address) => IDex<any, any>) => {
    const dexObj = new dex(augustusAddress);
    acc[dexObj.getDEXKey()] = dexObj;
    return acc;
  }, {});
}
