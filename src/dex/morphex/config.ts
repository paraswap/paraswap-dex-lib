import { DexParams } from '../gmx/types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MorphexConfig: DexConfigMap<DexParams> = {
  Morphex: {
    [Network.FANTOM]: {
      vault: '0x3CB54f0eB62C371065D739A34a775CC16f46563e',
      reader: '0x8BC6D6d2cdD68E51a8046F2C570824027842eD8D',
      priceFeed: '0x1e4eed8fd57DFBaaE060F894582eC0183c5D6e38',
      fastPriceFeed: '0x89BE4cF89c425F74b2d0691A268A9a421e9dce7b',
      fastPriceEvents: '0xD09eF52d1BB74D67B0c508b932E90f8a6B7F1884',
      usdg: '0xB7209EbCBF71c0ffA1585B4468A11CFfdcDBB9a9',
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
