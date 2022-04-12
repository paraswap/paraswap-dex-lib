import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const TetuswapConfig: DexConfigMap<DexParams> = {
  Tetuswap: {
    // TODO: complete me!
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  // TODO: add adapters for each chain
};
