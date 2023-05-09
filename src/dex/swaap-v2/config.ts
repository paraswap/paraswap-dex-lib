import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const SwaapV2Config: DexConfigMap<DexParams> = {
  SwaapV2: {
    [Network.MAINNET]: {
      routerAddress: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    },
    [Network.ARBITRUM]: {
      routerAddress: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    },
    [Network.POLYGON]: {
      routerAddress: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter01', index: 9 }], // TODO: update with the proper adapter
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 5 }], // TODO: update with the proper adapter
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 9 }], // TODO: update with the proper adapter
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 5 }], // TODO: update with the proper adapter
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 9 }], // TODO: update with the proper adapter
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 5 }], // TODO: update with the proper adapter
  },
};
