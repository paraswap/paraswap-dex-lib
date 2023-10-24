import { DexParams } from '../gmx/types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const BMXConfig: DexConfigMap<DexParams> = {
  Bmx: {
    [Network.BASE]: {
      vault: '0xec8d8D4b215727f3476FF0ab41c406FA99b4272C',
      reader: '0x92C97631450E804848781C0764907Ec4FC6fFd29',
      priceFeed: '0x786AcC981FB93a12D5d195903C5C0d6D9c633cd8',
      fastPriceFeed: '0x1e4eed8fd57DFBaaE060F894582eC0183c5D6e38',
      fastPriceEvents: '0x662B64186B50d5346321cf4740119EF04A72De27',
      usdg: '0xE974A88385935CB8846482F3Ab01b6c0f70fa5f3',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  [Network.BASE]: {
    [SwapSide.SELL]: [
      {
        name: 'BaseAdapter01',
        index: 6, // TODO: there is no BMX adapter
      },
    ],
  },
};
