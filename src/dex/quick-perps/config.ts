import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const QuickPerpsConfig: DexConfigMap<DexParams> = {
  QuickPerps: {
    [Network.ZKEVM]: {
      vault: '0x99B31498B0a1Dae01fc3433e3Cb60F095340935C',
      reader: '0xf1CFB75854DE535475B88Bb6FBad317eea98c0F9',
      priceFeed: '0x5b1F500134bdD7f4359F5B2adC65f839737290f4',
      fastPriceFeed: '0x73903fEc691a80Ec47bc830bf3F0baD127A06e30',
      fastPriceEvents: '0x08bC8ef0b71238055f9Ee6BBc90869D8d0DBdCCa',
      usdq: '0x48aC594dd00c4aAcF40f83337fc6dA31F9F439A7',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  [Network.ZKEVM]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonZkEvmAdapter01',
        index: 2,
      },
    ],
  },
};
