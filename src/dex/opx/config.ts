import { DexParams } from '../gmx/types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const OPXConfig: DexConfigMap<DexParams> = {
  OPX: {
    [Network.OPTIMISM]: {
      vault: '0xb94C36A74c8504Dea839C119aeaF2e615364253F',
      reader: '0x0A7749f1292aAB7768312De621bEf08eb0B434Df',
      priceFeed: '0xC08948bcE8405250f33e713A13d5f4f433c7a35C',
      fastPriceFeed: '0x8cfeC6a56Dd51d3A6d7a6A48eCDC35776145Ae9f',
      fastPriceEvents: '0x33ae89e2e7712C9A09c3957Cd6e1F0D69C106Ce8',
      usdg: '0x69660d68E31F0217F955da8638e08E6b8F0c6296',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [
      {
        name: 'OptimismAdapter01',
        index: 11,
      },
    ],
  },
};
