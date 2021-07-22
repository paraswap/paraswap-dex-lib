import { RouterMap } from './irouter';
import { DexMap } from '../dex/idex';
import { MultiSwap } from './multiswap';
import { MegaSwap } from './megaswap';
import { SimpleSwap } from './simpleswap';
import { ContractMethod } from '../constants';
import { Adapters } from '../types';

export function getRouterMap(dexMap: DexMap, adapters: Adapters): RouterMap {
  return {
    [ContractMethod.multiSwap.toLowerCase()]: new MultiSwap(dexMap, adapters),
    [ContractMethod.megaSwap.toLowerCase()]: new MegaSwap(dexMap, adapters),
    [ContractMethod.simpleSwap.toLowerCase()]: new SimpleSwap(dexMap),
  };
}
