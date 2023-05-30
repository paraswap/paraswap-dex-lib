import { DexParams } from '../uniswap-v3/types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

const PANCAKE_SUPPORTED_FEES = [10000n, 2500n, 500n, 100n];

// Pools that will be initialized on app startup
// They are added for testing
export const PancakeswapV3Config: DexConfigMap<DexParams> = {
  PancakeswapV3: {
    [Network.MAINNET]: {
      factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
      deployer: '0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9',
      quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
      router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
      supportedFees: PANCAKE_SUPPORTED_FEES,
      stateMulticall: '0x80898f80cFA3Fa3AbF410d90e69aDc432AE5D4c2',
      uniswapMulticall: '0xac1cE734566f390A94b00eb9bf561c2625BF44ea',
      chunksCount: 10,
      initHash:
        '0x6ce8eb472fa82df5469c6ab6d485f17c3ad13c8cd7af59b3d4a8026c5ce0f7e2',
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-eth',
    },
    [Network.BSC]: {
      factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
      deployer: '0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9',
      quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
      router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
      supportedFees: PANCAKE_SUPPORTED_FEES,
      stateMulticall: '0x9DAd2ED7ADc6eaacf81589Cd043579c9684E5C81',
      uniswapMulticall: '0xac1cE734566f390A94b00eb9bf561c2625BF44ea',
      chunksCount: 10,
      initHash:
        '0x6ce8eb472fa82df5469c6ab6d485f17c3ad13c8cd7af59b3d4a8026c5ce0f7e2',
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter01', index: 6 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 2 }],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter02', index: 4 }],
    [SwapSide.BUY]: [{ name: 'BscBuyAdapter', index: 5 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 13 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 2 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 3 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 2 }],
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [{ name: 'OptimismAdapter01', index: 3 }],
    [SwapSide.BUY]: [{ name: 'OptimismBuyAdapter', index: 2 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 11 }],
    [SwapSide.BUY]: [{ name: 'FantomBuyAdapter', index: 3 }],
  },
};
