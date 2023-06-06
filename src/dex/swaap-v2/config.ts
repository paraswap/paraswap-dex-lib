import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const SwaapV2Config: DexConfigMap<DexParams> = {
  SwaapV2: {
    // Mainnet and Arbitrum will be supported later
    // [Network.MAINNET]: {
    //   routerAddress: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    // },
    // [Network.ARBITRUM]: {
    //   routerAddress: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    // },
    [Network.POLYGON]: {
      routerAddress: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 8 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 7 }],
  },
};
