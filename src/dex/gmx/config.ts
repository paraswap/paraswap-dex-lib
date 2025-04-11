import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const GMXConfig: DexConfigMap<DexParams> = {
  GMX: {
    [Network.AVALANCHE]: {
      vault: '0x9ab2De34A33fB459b538c43f251eB825645e8595',
      reader: '0x67b789D48c926006F5132BFCe4e976F0A7A63d5D',
      priceFeed: '0x205646b93b9d8070e15bc113449586875ed7288e',
      fastPriceFeed: '0x51073584619ce37298e02953b83a1d4ea4e52f8c',
      fastPriceEvents: '0x02b7023d43bc52bff8a0c54a9f2ecec053523bf6',
      usdg: '0xc0253c3cc6aa5ab407b5795a04c28fb063273894',
    },
    [Network.ARBITRUM]: {
      vault: '0x489ee077994B6658eAfA855C308275EAd8097C4A',
      reader: '0x22199a49A999c351eF7927602CFB187ec3cae489',
      priceFeed: '0x2d68011bca022ed0e474264145f46cc4de96a002',
      fastPriceFeed: '0x8960d1b45a2d15d063b84b34dfb2fb2ca7535527',
      fastPriceEvents: '0x4530b7de1958270a2376be192a24175d795e1b07',
      usdg: '0x45096e7aA921f27590f8F19e457794EB09678141',
    },
  },
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
  Voodoo: {
    [Network.BASE]: {
      vault: '0x4F188Afdc40e6D2Ddddf5fd1b2DF7AEF7Da52f50',
      reader: '0x8172d3Bc5b8585EE373B2dDe3878fA99618D291B',
      priceFeed: '0x75dBE30332d9C59963CFbC39f7c044254AccDE36',
      fastPriceFeed: '0x4fdd516a93FC937c76F03c6D605648Ed1D62Dd25',
      fastPriceEvents: '0x2Ed7F17BdF9a345c7e09F0c2Dd5B02B287f83bA2',
      usdg: '0x9ADBF75Db88E965e0d522F93F3c373341B62C1F2',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 11,
      },
    ],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [
      {
        name: 'ArbitrumAdapter01',
        index: 9,
      },
    ],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [
      {
        name: 'BscAdapter02',
        index: 6,
      },
    ],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [
      {
        name: 'FantomAdapter01',
        index: 12,
      },
    ],
  },
};
