import { DexParams } from '../gmx/types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MorphexConfig: DexConfigMap<DexParams> = {
  Morphex: {
    [Network.FANTOM]: {
      vault: '0x245cD6d33578de9aF75a3C0c636c726b1A8cbdAa',
      reader: '0xcA47b9b612a152ece991F31d8D3547D73BaF2Ecc',
      priceFeed: '0x7a451DE877CbB6551AACa671d0458B6f9dF1e29A',
      fastPriceFeed: '0x7f54C35A38D89fcf5Fe516206E6628745ed38CC7',
      fastPriceEvents: '0xDc7C389be5da32e326A261dC0126feCa7AE04d79',
      usdg: '0xe135c7BFfda932b5B862Da442cF4CbC4d43DC3Ad',
    },
    [Network.BSC]: {
      vault: '0x46940Dc651bFe3F2CC3E04cf9dC5579B50Cf0765',
      reader: '0x49A97680938B4F1f73816d1B70C3Ab801FAd124B',
      priceFeed: '0x0144b19D1B9338fC7C286d6767bd9b29F0347f27',
      fastPriceFeed: '0x55e6e6A968e485abEC1e1d957f408586e45a4f99',
      fastPriceEvents: '0x491Df61db853761d42C4F38BeD220E9D807143dE',
      usdg: '0x548f93779fBC992010C07467cBaf329DD5F059B7',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  [Network.FANTOM]: {
    [SwapSide.SELL]: [
      {
        name: 'FantomAdapter01',
        index: 6, // TODO: there is no Morphex adapter
      },
    ],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [
      {
        name: 'BscAdapter01',
        index: 6, // TODO: there is no Morphex adapter
      },
    ],
  },
};
