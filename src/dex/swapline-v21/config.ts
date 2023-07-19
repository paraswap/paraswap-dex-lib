import {DexParams} from './types';
import {DexConfigMap, AdapterMappings} from '../../types';
import {Network, SwapSide} from '../../constants';

export const SwaplineV21Config: DexConfigMap<DexParams> = {
  Swapline: {
    [Network.FANTOM]: {
      // factoryAddress: '',
      vault: '',
      reader: '',
      priceFeed: '',
      fastPriceFeed: '',
      fastPriceEvents: '',
      usdg: '',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.FANTOM]: {
    [SwapSide.SELL]: [
      {
        name: 'FantomAdapter01',
        index: 9,
      },
    ],
  },
};
