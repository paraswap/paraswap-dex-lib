import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const TraderJoeV2_1Config: DexConfigMap<DexParams> = {
  TraderJoeV21: {
    [Network.MAINNET]: {
      factoryAddress: '0xDC8d77b69155c7E68A95a4fb0f06a71FF90B943a',
      routerAddress: '0x9A93a421b74F1c5755b83dD2C211614dC419C44b',
    },
    [Network.ARBITRUM]: {
      factoryAddress: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e',
      routerAddress: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
    },
    [Network.BSC]: {
      factoryAddress: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e',
      routerAddress: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
    },
    [Network.AVALANCHE]: {
      factoryAddress: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e',
      routerAddress: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
    },
  },
};

// TODO: Check
export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter04', index: 6 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter02', index: 2 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter02', index: 9 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 9 }],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter02', index: 8 }],
    [SwapSide.BUY]: [{ name: 'BscBuyAdapter', index: 7 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 9 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 8 }],
  },
  [Network.BASE]: {
    [SwapSide.SELL]: [{ name: 'BaseAdapter01', index: 8 }],
    [SwapSide.BUY]: [{ name: 'BaseBuyAdapter', index: 5 }],
  },
};
