import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const InceptionConfig: DexConfigMap<DexParams> = {
  instETH: {
    [Network.MAINNET]: {
      vault: '0x814CC6B8fd2555845541FB843f37418b05977d8d',
      baseTokenSlug: 'STETH',
    },
  },
  inrETH: {
    [Network.MAINNET]: {
      token: '0x80d69e79258FE9D056c822461c4eb0B4ca8802E2',
      vault: '0x1Aa53BC4Beb82aDf7f5EDEE9e3bBF3434aD59F12',
      baseTokenSlug: 'rETH',
    },
  },
  inoETH: {
    [Network.MAINNET]: {
      token: '0x9181f633e9b9f15a32d5e37094f4c93b333e0e92',
      vault: '0x4878F636A9Aa314B776Ac51A25021C44CAF86bEd',
      baseTokenSlug: 'oETH',
    },
  },
  inosETH: {
    [Network.MAINNET]: {
      token: '0xfD07fD5EBEa6F24888a397997E262179Bf494336',
      vault: '0xA9F8c770661BeE8DF2D026edB1Cb6FF763C780FF',
      baseTokenSlug: 'osETH',
    },
  },
  inankrETH: {
    [Network.MAINNET]: {
      token: '0xfa2629B9cF3998D52726994E0FcdB750224D8B9D',
      vault: '0x36B429439AB227fAB170A4dFb3321741c8815e55',
      baseTokenSlug: 'AnkETH',
    },
  },
  incbETH: {
    [Network.MAINNET]: {
      token: '0xbf19eead55a6b100667f04f8fbc5371e03e8ab2e',
      vault: '0xfE715358368416E01d3A961D3a037b7359735d5e',
      baseTokenSlug: 'cbETH',
    },
  },
  inwbETH: {
    [Network.MAINNET]: {
      token: '0xda9b11cd701e10c2ec1a284f80820edd128c5246',
      vault: '0xC0660932C5dCaD4A1409b7975d147203B1e9A2B6',
      baseTokenSlug: 'wbETH',
    },
  },
  inswETH: {
    [Network.MAINNET]: {
      token: '0xc3ade5ace1bbb033ccae8177c12ecbfa16bd6a9d',
      vault: '0xc4181dC7BB31453C4A48689ce0CBe975e495321c',
      baseTokenSlug: 'SWETH',
    },
  },
  inETHx: {
    [Network.MAINNET]: {
      token: '0x57a5a0567187ff4a8dcc1a9bba86155e355878f2',
      vault: '0x90E80E25ABDB6205B08DeBa29a87f7eb039023C2',
      baseTokenSlug: 'ETHx',
    },
  },
  insfrxETH: {
    [Network.MAINNET]: {
      token: '0x668308d77be3533c909a692302cb4d135bf8041c',
      vault: '0x295234B7E370a5Db2D2447aCA83bc7448f151161',
      baseTokenSlug: 'sfrxETH',
    },
  },
  inmETH: {
    [Network.MAINNET]: {
      token: '0xeCf3672A6d2147E2A77f07069Fb48d8Cf6F6Fbf9',
      vault: '0xd0ee89d82183D7Ddaef14C6b4fC0AA742F426355',
      baseTokenSlug: 'mETH',
    },
  },
  inlsETH: {
    [Network.MAINNET]: {
      token: '0x94b888e11a9e960a9c3b3528eb6ac807b27ca62e',
      vault: '0x6E17a8b5D33e6DBdB9fC61d758BF554b6AD93322',
      baseTokenSlug: 'lsETH',
    },
  },
};

export const InceptionNativeConfig: DexConfigMap<DexParams> = {
  inETH: {
    [Network.MAINNET]: {
      token: '0xf073bAC22DAb7FaF4a3Dd6c6189a70D54110525C',
      vault: '0x46199cAa0e453971cedf97f926368d9E5415831a',
      baseTokenSlug: 'ETH',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
