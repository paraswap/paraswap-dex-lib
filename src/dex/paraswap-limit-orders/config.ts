import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const ParaswapLimitOrdersConfig: DexConfigMap<DexParams> = {
  ParaswapLimitOrders: {
    [Network.ROPSTEN]: {
      rfqAddress: '0x34268C38fcbC798814b058656bC0156C7511c0E4',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 9 }],
    [SwapSide.BUY]: [{ name: 'AvalancheBuyAdapter', index: 2 }],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 13 }],
    [SwapSide.BUY]: [{ name: 'BscBuyAdapter', index: 2 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 6 }],
    [SwapSide.BUY]: [{ name: 'FantomBuyAdapter', index: 2 }],
  },
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter03', index: 9 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 5 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 14 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 3 }],
  },
  [Network.ROPSTEN]: {
    [SwapSide.SELL]: [{ name: 'RopstenAdapter01', index: 2 }],
    [SwapSide.BUY]: [{ name: 'RopstenBuyAdapter', index: 2 }],
  },
};
