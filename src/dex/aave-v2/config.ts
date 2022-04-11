import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AaveV2Config: DexConfigMap<any> = {
  AaveV2: {
    [Network.MAINNET]: {},
    [Network.POLYGON]: {},
    [Network.AVALANCHE]: {},
  },
};

export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter01',
        index: 7,
      },
    ],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter01',
        index: 1,
      },
    ],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 7,
      },
    ],
  },
};
