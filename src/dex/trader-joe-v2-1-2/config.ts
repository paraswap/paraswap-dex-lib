import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const TraderJoeV2_1Config: DexConfigMap<DexParams> = {
  TraderJoeV2_1: {
    [Network.MAINNET]: {
      factory: '0xDC8d77b69155c7E68A95a4fb0f06a71FF90B943a',
      router: '0x9A93a421b74F1c5755b83dD2C211614dC419C44b',
      stateMulticall: '',
    },
    [Network.ARBITRUM]: {
      factory: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e',
      router: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
      stateMulticall: '',
    },
    [Network.BSC]: {
      factory: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e',
      router: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
      stateMulticall: '',
    },
    [Network.AVALANCHE]: {
      factory: '0x8e42f2F4101563bF679975178e880FD87d3eFd4e',
      router: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
      // stateMulticall: '0x2df9f089c85c22215a3af6fb89dc5FAe39dA0711',
      stateMulticall: '0xEECA9223063bD13e8ca77ed9e39a07f2BD1923E6',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter04', index: 5 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter02', index: 1 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter02', index: 4 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 7 }],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter02', index: 5 }],
    [SwapSide.BUY]: [{ name: 'BscBuyAdapter', index: 6 }],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter02', index: 4 }],
    [SwapSide.BUY]: [{ name: 'AvalancheBuyAdapter', index: 5 }],
  },
};
