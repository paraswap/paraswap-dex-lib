import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';
import { DexParam } from './types';

// TODO: find vals for V3
export const Config: DexConfigMap<DexParam> = {
  AaveV3: {
    [Network.FANTOM]: {
      ethGasCost: 246 * 100,
      lendingGasCost: 328 * 1000,
    },
    [Network.POLYGON]: {
      ethGasCost: 246 * 100,
      lendingGasCost: 328 * 1000,
    },
    [Network.AVALANCHE]: {
      ethGasCost: 246 * 100,
      lendingGasCost: 328 * 1000,
    },
  },
};

export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.FANTOM]: {
    [SwapSide.SELL]: [
      {
        name: 'FantomAdapter01',
        index: 6,
      },
    ],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter01',
        index: 14,
      },
    ],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 8,
      },
    ],
  },
};
