import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const NativeConfig: DexConfigMap<DexParams> = {
  Native: {
    [Network.MAINNET]: {
      routerAddress: '0xead050515e10fdb3540ccd6f8236c46790508a76',
    },
    [Network.POLYGON]: {
      routerAddress: '0x8c42cf13fbea2ac15b0fe5a5f3cf35eec65d7d7d',
    },
    [Network.BSC]: {
      routerAddress: '0xead050515e10fdb3540ccd6f8236c46790508a76',
    },
    [Network.ARBITRUM]: {
      routerAddress: '0xead050515e10fdb3540ccd6f8236c46790508a76',
    },
    [Network.AVALANCHE]: {
      routerAddress: '0xead050515e10fdb3540ccd6f8236c46790508a76',
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
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter02', index: 1 }],
    [SwapSide.BUY]: [{ name: 'AvalancheBuyAdapter', index: 3 }],
  },
};
