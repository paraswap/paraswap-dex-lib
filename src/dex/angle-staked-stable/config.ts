import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AngleStakedStableConfig: DexConfigMap<DexParams> = {
  AngleStakedStable: {
    [Network.ARBITRUM]: {
      agEUR: '0x',
      stEUR: '0x004626A008B1aCdC4c74ab51644093b155e59A23',
    },
    [Network.MAINNET]: {
      agEUR: '0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8',
      stEUR: '0x004626A008B1aCdC4c74ab51644093b155e59A23',
    },
    [Network.OPTIMISM]: {
      agEUR: '0x',
      stEUR: '0x004626A008B1aCdC4c74ab51644093b155e59A23',
    },
    [Network.POLYGON]: {
      agEUR: '0x',
      stEUR: '0x004626A008B1aCdC4c74ab51644093b155e59A23',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
