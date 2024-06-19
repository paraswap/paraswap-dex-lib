import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const MAV_V2_BASE_GAS_COST = 50_000;
export const MAV_V2_TICK_GAS_COST = 10_000;

export const MaverickV2Config: DexConfigMap<DexParams> = {
  MaverickV2: {
    [Network.BASE]: {
      poolLensAddress: `0x56eFfDD51b20705e152CAF482D9A6972e97B571C`,
      apiURL: 'https://maverick-v2-api-delta.vercel.app',
    },
    [Network.MAINNET]: {
      poolLensAddress: `0x56eFfDD51b20705e152CAF482D9A6972e97B571C`,
      apiURL: 'https://maverick-v2-api-delta.vercel.app',
    },
    [Network.BSC]: {
      poolLensAddress: `0x56eFfDD51b20705e152CAF482D9A6972e97B571C`,
      apiURL: 'https://maverick-v2-api-delta.vercel.app',
    },
    [Network.ARBITRUM]: {
      poolLensAddress: `0x56eFfDD51b20705e152CAF482D9A6972e97B571C`,
      apiURL: 'https://maverick-v2-api-delta.vercel.app',
    },
  },
};
