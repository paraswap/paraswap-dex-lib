import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

const KS_ELASTIC_CONFIG: DexParams = {
  factory: '0xC7a590291e07B9fe9E64b86c58fD8fC764308C4A',
  router: '0xF9c2b5746c946EF883ab2660BbbB1f10A5bdeAb4',
  positionManager: '0xe222fBE074A436145b255442D919E4E3A6c6a480',
  quoter: '0x4d47fd5a29904Dae0Ef51b1c450C9750F15D7856',
  ticksFeesReader: '0x8Fd8Cb948965d9305999D767A02bf79833EADbB3',
  tokenPositionDescriptor: '0x98565FcAD2080C5c19C3136fa367cE371cD40bD6',
  supportedFees: [1000n, 300n, 40n, 10n, 8n],
  poolInitHash:
    '0x00e263aaa3a2c06a89b53217a9e7aad7e15613490a72e0f95f303c4de2dc7045',
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
