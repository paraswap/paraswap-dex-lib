import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const InceptionConfig: DexConfigMap<DexParams[]> = {
  InceptionLRT: {
    [Network.MAINNET]: [
      {
        symbol: 'instETH',
        token: '0x7FA768E035F956c41d6aeaa3Bd857e7E5141CAd5',
        vault: '0x814CC6B8fd2555845541FB843f37418b05977d8d',
        baseToken: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        baseTokenSlug: 'STETH',
      },
      {
        symbol: 'inrETH',
        token: '0x80d69e79258FE9D056c822461c4eb0B4ca8802E2',
        vault: '0x1Aa53BC4Beb82aDf7f5EDEE9e3bBF3434aD59F12',
        baseToken: '0xae78736Cd615f374D3085123A210448E74Fc6393',
        baseTokenSlug: 'rETH',
      },
      {
        symbol: 'inoETH',
        token: '0x9181f633e9b9f15a32d5e37094f4c93b333e0e92',
        vault: '0x4878F636A9Aa314B776Ac51A25021C44CAF86bEd',
        baseToken: '0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3',
        baseTokenSlug: 'oETH',
      },
      {
        symbol: 'inosETH',
        token: '0xfD07fD5EBEa6F24888a397997E262179Bf494336',
        vault: '0xA9F8c770661BeE8DF2D026edB1Cb6FF763C780FF',
        baseToken: '0xf1C9acDc66974dFB6dEcB12aA385b9cD01190E38',
        baseTokenSlug: 'osETH',
      },
      {
        symbol: 'inankrETH',
        token: '0xfa2629B9cF3998D52726994E0FcdB750224D8B9D',
        vault: '0x36B429439AB227fAB170A4dFb3321741c8815e55',
        baseToken: '0xE95A203B1a91a908F9B9CE46459d101078c2c3cb',
        baseTokenSlug: 'AnkETH',
      },
      {
        symbol: 'incbETH',
        token: '0xbf19eead55a6b100667f04f8fbc5371e03e8ab2e',
        vault: '0xfE715358368416E01d3A961D3a037b7359735d5e',
        baseToken: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704',
        baseTokenSlug: 'cbETH',
      },
      {
        symbol: 'inwbETH',
        token: '0xda9b11cd701e10c2ec1a284f80820edd128c5246',
        vault: '0xC0660932C5dCaD4A1409b7975d147203B1e9A2B6',
        baseToken: '0xa2E3356610840701BDf5611a53974510Ae27E2e1',
        baseTokenSlug: 'wbETH',
      },
      {
        symbol: 'inswETH',
        token: '0xc3ade5ace1bbb033ccae8177c12ecbfa16bd6a9d',
        vault: '0xc4181dC7BB31453C4A48689ce0CBe975e495321c',
        baseToken: '0xf951E335afb289353dc249e82926178EaC7DEd78',
        baseTokenSlug: 'SWETH',
      },
      {
        symbol: 'inETHx',
        token: '0x57a5a0567187ff4a8dcc1a9bba86155e355878f2',
        vault: '0x90E80E25ABDB6205B08DeBa29a87f7eb039023C2',
        baseToken: '0xA35b1B31Ce002FBF2058D22F30f95D405200A15b',
        baseTokenSlug: 'ETHx',
      },
      {
        symbol: 'insfrxETH',
        token: '0x668308d77be3533c909a692302cb4d135bf8041c',
        vault: '0x295234B7E370a5Db2D2447aCA83bc7448f151161',
        baseToken: '0xac3E018457B222d93114458476f3E3416Abbe38F',
        baseTokenSlug: 'sfrxETH',
      },
      {
        symbol: 'inmETH',
        token: '0xeCf3672A6d2147E2A77f07069Fb48d8Cf6F6Fbf9',
        vault: '0xd0ee89d82183D7Ddaef14C6b4fC0AA742F426355',
        baseToken: '0xd5F7838F5C461fefF7FE49ea5ebaF7728bB0ADfa',
        baseTokenSlug: 'mETH',
      },
      {
        symbol: 'inlsETH',
        token: '0x94b888e11a9e960a9c3b3528eb6ac807b27ca62e',
        vault: '0x6E17a8b5D33e6DBdB9fC61d758BF554b6AD93322',
        baseToken: '0x8c1BEd5b9a0928467c9B1341Da1D7BD5e10b6549',
        baseTokenSlug: 'lsETH',
      },
      {
        symbol: 'inETH',
        token: '0xf073bAC22DAb7FaF4a3Dd6c6189a70D54110525C',
        vault: '0x46199cAa0e453971cedf97f926368d9E5415831a',
        baseToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        baseTokenSlug: 'ETH',
      },
    ],
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
