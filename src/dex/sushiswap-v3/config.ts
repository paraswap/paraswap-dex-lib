import { Network, SwapSide } from '../../constants';
import { DexParams } from '../uniswap-v3/types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { SUPPORTED_FEES } from '../uniswap-v3/config';

export const SushiSwapV3Config: DexConfigMap<DexParams> = {
  SushiSwapV3: {
    [Network.MAINNET]: {
      factory: '0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F',
      quoter: '0x64e8802FE490fa7cc61d3463958199161Bb608A7',
      router: '0x827179dD56d07A7eeA32e3873493835da2866976',
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
      router: '0x0a6e511Fe663827b9cA7e2D2542b20B37fC217A6',
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
      router: '0x400d75dAb26bBc18D163AEA3e83D9Ea68F6c1804',
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
      router: '0x717b7948AA264DeCf4D780aa6914482e5F46Da3e',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '',
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
      router: '0x2214A42d8e2A1d20635c2cb0664422c528B6A432',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '',
      uniswapMulticall: '0xB1395e098c0a847CC719Bcf1Fc8114421a9F8232',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/sushi-v3/v3-fantom',
    },
    [Network.ARBITRUM]: {
      factory: '0x1af415a1eba07a4986a52b6f2e7de7003d82231e',
      quoter: '0x0524E833cCD057e4d7A296e3aaAb9f7675964Ce1',
      router: '0xfc506AaA1340b4dedFfd88bE278bEe058952D674',
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
      router: '0x4C5D5234f232BD2D76B96aA33F5AE4FCF0E4BFAb',
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
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter02', index: 6 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 8 }],
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
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 11 }],
    [SwapSide.BUY]: [{ name: 'FantomBuyAdapter', index: 3 }],
  },
};
