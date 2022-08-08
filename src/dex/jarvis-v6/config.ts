import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const JarvisV6Config: DexConfigMap<DexParams> = {
  JarvisV6: {
    // TODO: complete me!
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.POLYGON]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
