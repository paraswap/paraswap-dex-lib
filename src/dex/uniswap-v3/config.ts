import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Address } from '../../types';

const SUPPORTED_FEES = [10000n, 3000n, 500n, 100n];

// Pools that will be initialized on app startup
// They are added for testing
export const PoolsToPreload: DexConfigMap<
  { token0: Address; token1: Address }[]
> = {
  UniswapV3: {
    [Network.POLYGON]: [
      {
        token0: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'.toLowerCase(),
        token1: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(),
      },
      {
        token0: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'.toLowerCase(),
        token1: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(),
      },
    ],
  },
};

export const UniswapV3Config: DexConfigMap<DexParams> = {
  UniswapV3: {
    [Network.MAINNET]: {
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x9c764D2e92dA68E4CDfD784B902283A095ff8b63',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
    },
    [Network.BSC]: {
      factory: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7',
      quoter: '0x78D78E420Da98ad378D7799bE8f4AF69033EB077',
      router: '0x83c346ba3d4bf36b308705e24fad80999401854b',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x593F39A4Ba26A9c8ed2128ac95D109E8e403C485',
      uniswapMulticall: '0x963Df249eD09c358A4819E39d9Cd5736c3087184',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-bsc',
    },
    [Network.POLYGON]: {
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x6Dc993Fe1e945A640576B4Dca81281d8e998DF71',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon',
    },
    [Network.ARBITRUM]: {
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0xaBB58098A7B5172A9b0B38a1925A522dbf0b4FC3',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal',
    },
    [Network.OPTIMISM]: {
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x4FF0dEC5f9a763Aa1E5C2a962aa6f4eDFeE4f9eA',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis',
    },
    [Network.AVALANCHE]: {
      factory: '0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD',
      quoter: '0xbe0F5544EC67e9B3b2D979aaA43f18Fd87E6257F',
      router: '0x33895c09a0ec0718ce66ab35dfd0b656d77cd053',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x30F6B9b6485ff0B67E881f5ac80D3F1c70A4B23d',
      uniswapMulticall: '0x0139141Cd4Ee88dF3Cdb65881D411bAE271Ef0C2',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/lynnshaoyu/uniswap-v3-avax',
    },
  },
  'QuickSwapV3.1': {
    [Network.ZKEVM]: {
      factory: '0xD9a2AD9E927Bd7014116CC5c7328f028D4318178',
      quoter: '0xc2f30976cebf6b7400fe1300540a342411340d29',
      router: '0x1e7e4c855520b2106320952a570a3e5e3e618101',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x983ab0171159b7e17835cc6aec70c72b8aadb133',
      uniswapMulticall: '0x61530d6E1c7A47BBB3e48e8b8EdF7569DcFeE121',
      chunksCount: 5,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.studio.thegraph.com/query/44554/uniswap-v3/version/latest',
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
  [Network.ZKEVM]: {
    [SwapSide.SELL]: [{ name: 'PolygonZkEvmAdapter01', index: 1 }],
    [SwapSide.BUY]: [{ name: 'PolygonZkEvmBuyAdapter', index: 1 }],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter02', index: 5 }],
    [SwapSide.BUY]: [{ name: 'AvalancheBuyAdapter', index: 6 }],
  },
};
