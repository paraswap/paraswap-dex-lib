import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const WethConfig: DexConfigMap<DexParams> = {
  Weth: {
    // TODO: complete me!
  }
};

export const Adapters: { [chainId: number]: { name: string; index: number }[] | null } = {
  // TODO: add adapters for each chain 
};
