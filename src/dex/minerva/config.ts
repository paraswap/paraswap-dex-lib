import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MinervaConfig: DexConfigMap<DexParams> = {
  Minerva: {
    [Network.OPTIMISM]: {
      vault: '0x7EF6f8abAc00689e057C9ec14E34aC232255a2fb',
      reader: '0x8c03AE02f0a5EA3f75D7604eaeFa2Dd074AE8947',
      priceFeed: '0xc15fAE1AdCE641Dd9b14ed8D30b0df19190096E0',
      fastPriceFeed: '0xd580FD6D1E3788835f643bfa9467310B7e338618',
      fastPriceEvents: '0xB9371c2fFDE93055018744D9AED89277714b655a',
      usdm: '0x6CdC00A448fB093575f82279c85fc99db00A74A4',
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
        index: 8,
      },
    ],
  },
};
