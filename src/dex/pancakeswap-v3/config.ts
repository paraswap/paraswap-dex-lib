import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

const SUPPORTED_FEES = [10000n, 2500n, 500n, 100n];

export const PancakeswapV3Config: DexConfigMap<DexParams> = {
  PancakeswapV3: {
    [Network.MAINNET]: {
      factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
      deployer: '0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9',
      quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
      router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x80898f80cFA3Fa3AbF410d90e69aDc432AE5D4c2',
      pancakeswapMulticall: '0xac1cE734566f390A94b00eb9bf561c2625BF44ea',
      chunksCount: 10,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-eth',
    },
    [Network.BSC]: {
      factory: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
      deployer: '0x41ff9AA7e16B8B1a8a8dc4f0eFacd93D02d071c9',
      quoter: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
      router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x9DAd2ED7ADc6eaacf81589Cd043579c9684E5C81',
      pancakeswapMulticall: '0xac1cE734566f390A94b00eb9bf561c2625BF44ea',
      chunksCount: 10,
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
};
