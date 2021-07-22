import { JsonRpcProvider } from '@ethersproject/providers';
import { Address } from '../types';
import { DexMap, IDex } from './idex';
import { UniswapV2 } from './uniswap-v2';
import { ZeroX } from './zerox';

export function getDexMap(augustusAddress: Address, network: number, provider: JsonRpcProvider): DexMap {
  const dexes = [UniswapV2, ZeroX];
  return dexes.reduce((acc: DexMap, dex: new (augustusAddress: Address, network: number, provider: JsonRpcProvider) => IDex<any, any>) => {
    const dexObj = new dex(augustusAddress, network, provider);
    acc[dexObj.getDEXKey()] = dexObj;
    return acc;
  }, {});
}
