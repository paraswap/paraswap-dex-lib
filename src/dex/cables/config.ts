import { Network, SwapSide } from '../../constants';
import { AdapterMappings, DexConfigMap } from '../../types';

export const CablesConfig: DexConfigMap<{ mainnetRFQAddress: string }> = {
  Cables: {
    [Network.AVALANCHE]: {
      mainnetRFQAddress: '0xa274DC2569fa8574293F8B631C85d50232f7A3D6',
    },
    [Network.ARBITRUM]: {
      mainnetRFQAddress: '0x00C11C4b2a54a3742B96f55c0Fdd65f6e81a5B96',
    },
  },
};

export const CablesAdapters: Record<number, AdapterMappings> = {
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter02', index: 6 }],
    [SwapSide.BUY]: [{ name: 'AvalancheBuyAdapter', index: 8 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter03', index: 2 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 11 }],
  },
};
