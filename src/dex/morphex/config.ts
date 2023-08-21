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
        index: 6, // TODO: it's for aavev3, but there is no Morphex adapter
      },
    ],
  },
};
