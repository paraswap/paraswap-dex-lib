import { Network, SwapSide } from '../../constants';
import { AdapterMappings, DexConfigMap } from '../../types';

export const CablesConfig: DexConfigMap<{ mainnetRFQAddress: string }> = {
  Cables: {
    [Network.AVALANCHE]: {
      mainnetRFQAddress: '0xe3A95146129B9218E717054a4f830f1B2755193E',
    },
    [Network.ARBITRUM]: {
      mainnetRFQAddress: '0xD7961aa9ad7b6a61F2a8958C44DbF4b17DB57EBB',
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
