import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WombatConfig: DexConfigMap<DexParams> = {
  Wombat: {
    [Network.BSC]: {
      bmwAddress: '0x489833311676B566f888119c29bd997Dc6C95830',
    },
    [Network.ARBITRUM]: {
      bmwAddress: '0x62A83C6791A3d7950D823BB71a38e47252b6b6F4',
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
