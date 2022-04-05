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
        name: 'PolygonAdapter01',
        index: 14,
      },
    ],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 8,
      },
    ],
  },
};
