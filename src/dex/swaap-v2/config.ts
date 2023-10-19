import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const SwaapV2Config: DexConfigMap<DexParams> = {
  SwaapV2: {
    [Network.MAINNET]: {},
    [Network.POLYGON]: {},
    // Arbitrum will be supported later
    // [Network.ARBITRUM]: {},
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter04', index: 3 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 10 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 8 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 7 }],
  },
};
