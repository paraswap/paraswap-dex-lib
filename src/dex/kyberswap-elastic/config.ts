import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

const KS_ELASTIC_CONFIG: DexParams = {
  factory: '0x5F1dddbf348aC2fbe22a163e30F99F9ECE3DD50a',
  router: '0xC1e7dFE73E1598E3910EF4C7845B68A9Ab6F4c83',
  positionManager: '0x2B1c7b41f6A8F2b2bc45C3233a5d5FB3cD6dC9A8',
  quoter: '0x0D125c15D54cA1F8a813C74A81aEe34ebB508C1f',
  ticksFeesReader: '0x165c68077ac06c83800d19200e6E2B08D02dE75D',
  tokenPositionDescriptor: '0x8abd8c92F1901cf204590c16b5EF690a35b3741E',
  supportedFees: [1000n, 300n, 40n, 10n, 8n],
  initHash:
    '0xc597aba1bb02db42ba24a8878837965718c032f8b46be94a6e46452a9f89ca01',
  chunksCount: 10,
};

const SUBGRAPH_BASE_URL =
  'https://api.thegraph.com/subgraphs/name/kybernetwork';

export const KyberswapElasticConfig: DexConfigMap<DexParams> = {
  KyberswapElastic: {
    [Network.MAINNET]: {
      ...KS_ELASTIC_CONFIG,
      subgraphURL: `${SUBGRAPH_BASE_URL}/kyberswap-elastic-mainnet`,
    },
    [Network.BSC]: {
      ...KS_ELASTIC_CONFIG,
      subgraphURL: `${SUBGRAPH_BASE_URL}/kyberswap-elastic-bsc`,
    },
    [Network.ARBITRUM]: {
      ...KS_ELASTIC_CONFIG,
      subgraphURL: `${SUBGRAPH_BASE_URL}/kyberswap-elastic-arbitrum-one`,
    },
    [Network.POLYGON]: {
      ...KS_ELASTIC_CONFIG,
      subgraphURL: `${SUBGRAPH_BASE_URL}/kyberswap-elastic-matic`,
    },
    [Network.OPTIMISM]: {
      ...KS_ELASTIC_CONFIG,
      subgraphURL: `${SUBGRAPH_BASE_URL}/kyberswap-elastic-optimism`,
    },
    [Network.FANTOM]: {
      ...KS_ELASTIC_CONFIG,
      subgraphURL: `${SUBGRAPH_BASE_URL}/kyberswap-elastic-fantom`,
    },
    [Network.AVALANCHE]: {
      ...KS_ELASTIC_CONFIG,
      subgraphURL: `${SUBGRAPH_BASE_URL}/kyberswap-elastic-avalanche`,
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
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 3 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 2 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 13 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 2 }],
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [{ name: 'OptimismAdapter01', index: 3 }],
    [SwapSide.BUY]: [{ name: 'OptimismBuyAdapter', index: 2 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 11 }],
    [SwapSide.BUY]: [{ name: 'FantomBuyAdapter', index: 3 }],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvanlancheAdapter01', index: 12 }],
    [SwapSide.BUY]: [{ name: 'AvanlancheBuyAdapter', index: 7 }],
  },
};
