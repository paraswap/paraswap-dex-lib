import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WooFiV2Config: DexConfigMap<DexParams> = {
  WooFiV2: {
    // TODO: complete me!
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: { [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 13 }] },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 12 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 8 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 4 }],
  },

  // TODO: Deploy new adapter for WooFiV2 on new chains and update this config
};
