import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const InceptionConfig: DexConfigMap<DexParams> = {
  instETH: {
    [Network.MAINNET]: {
      vault: '0x814CC6B8fd2555845541FB843f37418b05977d8d',
      baseTokenSlug: 'STETH',
    },
  },
};

export const InceptionNativeConfig: DexConfigMap<DexParams> = {
  inETH: {
    [Network.MAINNET]: {
      token: '0xf073bAC22DAb7FaF4a3Dd6c6189a70D54110525C',
      vault: '0x46199cAa0e453971cedf97f926368d9E5415831a',
      baseTokenSlug: 'ETH',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
