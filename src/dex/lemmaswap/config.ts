import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const LemmaswapConfig: DexConfigMap<DexParams> = {
  Lemmaswap: {
    // TODO: complete me!
    [Network.OPTIMISM]: {
      poolGasCost: 80 * 1000,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [{ name: 'OptimismAdapter01', index: 7 }],
  },
};
