import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AngleStakedStableConfig: DexConfigMap<DexParams> = {
  AngleStakedStable: {
    [Network.ARBITRUM]: {
      agEUR: '0xfa5ed56a203466cbbc2430a43c66b9d8723528e7',
      stEUR: '0x004626A008B1aCdC4c74ab51644093b155e59A23',
    },
    [Network.MAINNET]: {
      agEUR: '0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8',
      stEUR: '0x004626A008B1aCdC4c74ab51644093b155e59A23',
    },
    [Network.OPTIMISM]: {
      agEUR: '0x9485aca5bbbe1667ad97c7fe7c4531a624c8b1ed',
      stEUR: '0x004626A008B1aCdC4c74ab51644093b155e59A23',
    },
    [Network.POLYGON]: {
      agEUR: '0xe0b52e49357fd4daf2c15e02058dce6bc0057db4',
      stEUR: '0x004626A008B1aCdC4c74ab51644093b155e59A23',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
