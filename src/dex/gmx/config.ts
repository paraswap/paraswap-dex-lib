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
};
