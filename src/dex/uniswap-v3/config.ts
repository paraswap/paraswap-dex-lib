import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Address } from '../../types';
import RamsesV2StateMulticallABI from '../../abi/RamsesV2StateMulticall.abi.json';
import { AbiItem } from 'web3-utils';
import { decodeStateMultiCallResultWithRelativeBitmaps } from './forks/ramses-v2/utils';

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
    [Network.BASE]: {
      factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
      quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
      router: '0xaeE2b8d4A154e36f479dAeCe3FB3e6c3c03d396E',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x7160f736c52e1e78e92FD4eE4D73e21A7Cf4F950',
      uniswapMulticall: '0x091e99cb1C49331a94dD62755D168E941AbD0693',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/lynnshaoyu/uniswap-v3-base',
    },
  },
  SushiSwapV3: {
    [Network.MAINNET]: {
      factory: '0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F',
      quoter: '0x64e8802FE490fa7cc61d3463958199161Bb608A7',
      router: '0x00F23572b16c5e9e58e7b965DEF51Ff8Ff546E34',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x9c764D2e92dA68E4CDfD784B902283A095ff8b63',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sushi-v3/v3-ethereum',
    },
    [Network.POLYGON]: {
      factory: '0x917933899c6a5f8e37f31e19f92cdbff7e8ff0e2',
      quoter: '0xb1E835Dc2785b52265711e17fCCb0fd018226a6e',
      router: '0x34D41cE301257a4615D4F5AD260FA91D03925243',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x6Dc993Fe1e945A640576B4Dca81281d8e998DF71',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sushi-v3/v3-polygon',
    },
    [Network.BSC]: {
      factory: '0x126555dd55a39328F69400d6aE4F782Bd4C34ABb',
      quoter: '0xb1E835Dc2785b52265711e17fCCb0fd018226a6e',
      router: '0xDCf4EE5B700e2a5Fec458e06B763A4a3E3004494',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x593F39A4Ba26A9c8ed2128ac95D109E8e403C485',
      uniswapMulticall: '0x963Df249eD09c358A4819E39d9Cd5736c3087184',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/sushi-v3/v3-bsc',
    },
    [Network.AVALANCHE]: {
      factory: '0x3e603C14aF37EBdaD31709C4f848Fc6aD5BEc715',
      quoter: '0xb1E835Dc2785b52265711e17fCCb0fd018226a6e',
      router: '0x24c90C7d8fb463722e304A71255341610Fa7589b',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x30F6B9b6485ff0B67E881f5ac80D3F1c70A4B23d',
      uniswapMulticall: '0x8C0F842791F03C095b6c633759224FcC9ACe68ea',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sushi-v3/v3-avalanche',
    },
    [Network.FANTOM]: {
      factory: '0x7770978eED668a3ba661d51a773d3a992Fc9DDCB',
      quoter: '0xb1E835Dc2785b52265711e17fCCb0fd018226a6e',
      router: '0xDCf4EE5B700e2a5Fec458e06B763A4a3E3004494',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x30F6B9b6485ff0B67E881f5ac80D3F1c70A4B23d',
      uniswapMulticall: '0xB1395e098c0a847CC719Bcf1Fc8114421a9F8232',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/sushi-v3/v3-fantom',
    },
    [Network.ARBITRUM]: {
      factory: '0x1af415a1eba07a4986a52b6f2e7de7003d82231e',
      quoter: '0x0524E833cCD057e4d7A296e3aaAb9f7675964Ce1',
      router: '0xbDa4176fD98b47018aF673805d069b9dbd49373D',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0xaBB58098A7B5172A9b0B38a1925A522dbf0b4FC3',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sushi-v3/v3-arbitrum',
    },
    [Network.OPTIMISM]: {
      factory: '0x9c6522117e2ed1fE5bdb72bb0eD5E3f2bdE7DBe0',
      quoter: '0xb1E835Dc2785b52265711e17fCCb0fd018226a6e',
      router: '0xa05d8C3F278fC7b20b39Ea7A3035E3aD8D808c78',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x4FF0dEC5f9a763Aa1E5C2a962aa6f4eDFeE4f9eA',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sushi-v3/v3-optimism',
    },
  },
  ChronosV3: {
    [Network.ARBITRUM]: {
      factory: '0x4Db9D624F67E00dbF8ef7AE0e0e8eE54aF1dee49',
      quoter: '0x6E7f0Ca45171a4440c0CDdF3A46A8dC5D4c2d4A0',
      router: '0xE0aBdFD837D451640CF43cB1Ec4eE87976eFbb41',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x46b44eb4Cc3bEbB9f04C419f691aB85Ff885A4D6',
      uniswapMulticall: '0xaBB58098A7B5172A9b0B38a1925A522dbf0b4FC3',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash:
        '0x09c178be473df44d1de6970978a4fdedce1ce52a23b2b979754547f6b43a19a5',
      subgraphURL:
        'https://subgraph.chronos.exchange/subgraphs/name/chronos-v3',
    },
  },
  RamsesV2: {
    [Network.ARBITRUM]: {
      factory: '0xAA2cd7477c451E703f3B9Ba5663334914763edF8',
      deployer: '0xb3e423ab9cE6C03D98326A3A2a0D7D96b0829f22',
      quoter: '0xAA20EFF7ad2F523590dE6c04918DaAE0904E3b20',
      router: '0xAA23611badAFB62D37E7295A682D21960ac85A90',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x50EE4112Cab9c79812F23bE079aB3911395ACc8e',
      stateMultiCallAbi: RamsesV2StateMulticallABI as AbiItem[],
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      decodeStateMultiCallResultWithRelativeBitmaps,
      initHash:
        '0x1565b129f2d1790f12d45301b9b084335626f0c92410bc43130763b69971135d',
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/ramsesexchange/concentrated-liquidity-graph',
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
      initRetryFrequency: 30,
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
  [Network.BASE]: {
    [SwapSide.SELL]: [{ name: 'BaseAdapter01', index: 1 }],
    [SwapSide.BUY]: [{ name: 'BaseBuyAdapter', index: 1 }],
  },
};
