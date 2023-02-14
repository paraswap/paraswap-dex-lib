import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const HashflowConfig: DexConfigMap<DexParams> = {
  Hashflow: {
    [Network.MAINNET]: {
      routerAddress: '0xf6a94dfd0e6ea9ddfdffe4762ad4236576136613',
    },
    [Network.POLYGON]: {
      routerAddress: '0x72550597dc0b2e0bec24e116add353599eff2e35',
    },
    [Network.BSC]: {
      routerAddress: '0x0acffb0fb2cddd9bd35d03d359f3d899e32facc9',
    },
    [Network.ARBITRUM]: {
      routerAddress: '0x1f772fa3bc263160ea09bb16ce1a6b8fc0fab36a',
    },
    [Network.AVALANCHE]: {
      routerAddress: '0x64d2f9f44fe26c157d552ae7eaa613ca6587b59e',
    },
    [Network.OPTIMISM]: {
      routerAddress: '0xb3999f658c0391d94a37f7ff328f3fec942bcadc',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter03', index: 14 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 7 }],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter02', index: 2 }],
    [SwapSide.BUY]: [{ name: 'BscBuyAdapter', index: 3 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 7 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 5 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 14 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 4 }],
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [{ name: 'OptimismAdapter01', index: 10 }],
    [SwapSide.BUY]: [{ name: 'OptimismBuyAdapter', index: 4 }],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 14 }],
    [SwapSide.BUY]: [{ name: 'AvalancheBuyAdapter', index: 3 }],
  },
};
