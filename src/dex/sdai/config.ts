import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { SwapSide } from '@paraswap/core';

export const SDaiConfig: DexConfigMap<DexParams> = {
  SDai: {
    [Network.MAINNET]: {
      sdaiAddress: '0x83f20f44975d03b1b09e64809b757c47f942beea',
      daiAddress: '0x0',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[];
  };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter04', index: 4 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 11 }],
  },
};
