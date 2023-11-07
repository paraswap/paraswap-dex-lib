import { DexParams } from './types';
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
      wblt: '0x4e74d4db6c0726ccded4656d0bce448876bb4c7a',
      rewardRouter: '0x49a97680938b4f1f73816d1b70c3ab801fad124b',
      glpManager: '0x9fac7b75f367d5b35a6d6d0a09572efcc3d406c5',
      stakedGLP: '0x64755939a80bc89e1d2d0f93a312908d348bc8de',
      glpAddress: '0xe771b4E273dF31B85D7A7aE0Efd22fb44BdD0633',
      wbltHelper: '0x49f519002EEcEd6902F24C0BE72B6D898e4D27FC',
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
