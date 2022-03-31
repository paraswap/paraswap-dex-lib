import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { ThreePool } from './pools/Three-pool';
import { SwapSide } from 'paraswap-core';

export const NerveConfig: DexConfigMap<DexParams> = {
  Nerve: {
    // TODO: complete me!
    [Network.BSC]: {
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[];
  };
} = {
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 4 }],
  },
};
