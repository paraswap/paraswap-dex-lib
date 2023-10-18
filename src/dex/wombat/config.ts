import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WombatConfig: DexConfigMap<DexParams> = {
  Wombat: {
    [Network.BSC]: {
      pools: [
        {
          address: '0x312Bc7eAAF93f1C60Dc5AfC115FcCDE161055fb0',
          name: 'Wombat Main Pool',
        },
        /** @todo add Side and Dynamic pools */
      ],
    },
    [Network.ARBITRUM]: {
      pools: [
        {
          address: '0xc6bc781E20f9323012F6e422bdf552Ff06bA6CD1',
          name: 'Wombat Main Pool',
        },
      ],
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: {
    [SwapSide.SELL]: [
      {
        name: 'BscAdapter01',
        /** @todo check index number */
        index: 12,
      },
    ],
  },
};
