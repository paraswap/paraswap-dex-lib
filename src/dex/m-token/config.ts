import { DexConfigMap } from '../../types';
import { DexParams } from './types';
import { Network } from '../../constants';

export const Config: DexConfigMap<DexParams> = {
  MWrappedM: {
    [Network.MAINNET]: {
      MToken: {
        address: '0x866A2BF4E572CbcF37D5071A7a58503Bfb36be1b',
        decimals: 6,
      },
      WrappedM: {
        address: '0x437cc33344a0B27A429f795ff6B469C72698B291',
        decimals: 6,
      },
    },
  },
};
