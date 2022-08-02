import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const CurveConfig: DexConfigMap<DexParams> = {
  Curve: {
    // TODO: complete me!
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: 'Adapter01', index: 3 }] },
  [Network.BSC]: { [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 2 }] },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 3 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 3 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 6 }],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 5 }],
  },
};
