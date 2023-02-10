import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';
import { DexParam } from './types';

// TODO: find vals for V3
export const Config: DexConfigMap<DexParam> = {
  AaveV3: {
    [Network.FANTOM]: {
      ethGasCost: 246 * 100,
      lendingGasCost: 328 * 1000,
      poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      wethGatewayAddress: '0x17d013C19FE25cf4D911CE85eD5f40FE8880F46f',
    },
    [Network.POLYGON]: {
      ethGasCost: 246 * 100,
      lendingGasCost: 328 * 1000,
      poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      wethGatewayAddress: '0x9bdb5fcc80a49640c7872ac089cc0e00a98451b6',
    },
    [Network.AVALANCHE]: {
      ethGasCost: 246 * 100,
      lendingGasCost: 328 * 1000,
      poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      wethGatewayAddress: '0xa938d8536aEed1Bd48f548380394Ab30Aa11B00E',
    },
    [Network.ARBITRUM]: {
      ethGasCost: 246 * 100,
      lendingGasCost: 328 * 1000,
      poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      wethGatewayAddress: '0xC09e69E79106861dF5d289dA88349f10e2dc6b5C',
    },
    [Network.OPTIMISM]: {
      ethGasCost: 246 * 100,
      lendingGasCost: 328 * 1000,
      poolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
      wethGatewayAddress: '0x86b4D2636EC473AC4A5dD83Fc2BEDa98845249A7',
    },
    [Network.MAINNET]: {
      ethGasCost: 246 * 100,
      lendingGasCost: 328 * 1000,
      poolAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      wethGatewayAddress: '0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C',
    },
  },
};

export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.FANTOM]: {
    [SwapSide.SELL]: [
      {
        name: 'FantomAdapter01',
        index: 6,
      },
    ],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter02',
        index: 1,
      },
    ],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 9,
      },
    ],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [
      {
        name: 'ArbitrumAdapter01',
        index: 12,
      },
    ],
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [
      {
        name: 'OptimismAdapter01',
        index: 6,
      },
    ],
  },
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'MainnetAdapter03',
        index: 5,
      },
    ],
  },
};
