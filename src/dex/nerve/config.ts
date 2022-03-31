import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const NerveConfig: DexConfigMap<DexParams> = {
  Nerve: {
    // TODO: complete me!
    poolConfigs: {
      
    }
  }
};

export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] | null };
} = {
  // TODO: add adapters for each chain
};
