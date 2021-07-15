import { RouterMap } from './irouter';
import { DexMap } from '../dex/idex';
import { MultiSwap } from './multiswap';
import { MegaSwap } from './megaswap';
import { SimpleSwap } from './simpleswap';
import { ContractMethod } from '../constants';

export function getRouterMap(dexMap: DexMap): RouterMap {
  return {
    [ContractMethod.multiSwap.toLowerCase()]: new MultiSwap(dexMap),
    [ContractMethod.megaSwap.toLowerCase()]: new MegaSwap(dexMap),
    [ContractMethod.simpleSwap.toLowerCase()]: new SimpleSwap(dexMap),
  };
}
