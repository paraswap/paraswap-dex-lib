import { SparkParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { SwapSide } from '@paraswap/core';

export const SDaiConfig: DexConfigMap<SparkParams> = {
  Spark: {
    [Network.MAINNET]: {
      sdaiAddress: '0x83F20F44975D03b1b09e64809B757c47f942BEeA',
      daiAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      potAddress: '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[];
  };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter06', index: 1 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter02', index: 4 }],
  },
};
