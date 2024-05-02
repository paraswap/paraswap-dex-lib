import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { SwapSide } from '@paraswap/core';

export const SDaiConfig: DexConfigMap<DexParams> = {
  SDai: {
    [Network.MAINNET]: {
      sdaiAddress: '0x83F20F44975D03b1b09e64809B757c47f942BEeA',
      daiAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
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
