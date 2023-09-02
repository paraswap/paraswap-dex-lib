import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const SolidlyConfig: DexConfigMap<DexParams> = {
  Solidly: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/deusfinance/solidly',
      factoryAddress: '0x3faab499b519fdc5819e3d7ed0c26111904cbc28',
      router: '0x93d2611EB8b85bE4FDEa9D94Ce9913D90072eC0f',
      initCode:
        '0x57ae84018c47ebdaf7ddb2d1216c8c36389d12481309af65428eb6d460f747a4',
      // Fixed Fees, same for volatile and stable pools
      feeCode: 1,
      poolGasCost: 180 * 1000,
    },
  },
  SolidlyV2: {
    [Network.MAINNET]: {
      factoryAddress: '0x777de5Fe8117cAAA7B44f396E93a401Cf5c9D4d6',
      router: '0x5b39e7A1C706464F5B3956b21CD22a43F0dB0eAC',
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/0xc30/solidly',
      initCode:
        '0x413d36e4ab9e83cf39b8064a3b5c98253a9e46a6cf02c8efd185314c866d656b',
      stableFee: 200, // This is not fixed
      volatileFee: 2000,
      feeCode: 0,
      poolGasCost: 220 * 1000, // https://dashboard.tenderly.co/paraswap/paraswap/tx/mainnet/0x80f01d841ac01cfaedc93ceaadc88fc799ee1539841c2ac19cfccfdcfb605d70/gas-usage
      feeFactor: 1e6,
    },
  },
  Dystopia: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/dystopia-exchange/dystopia-v2',
      factoryAddress: '0x1d21Db6cde1b18c7E47B0F7F42f4b3F68b9beeC9',
      router: '0xc8DB3501281c192fFE9697A1b905b161ca0cd64d',
      initCode:
        '0x009bce6d7eb00d3d075e5bd9851068137f44bba159f1cde806a268e20baaf2e8',
      // Fixed Fees, same for volatile and stable pools
      feeCode: 5,
      poolGasCost: 180 * 1000,
    },
  },
  SpiritSwapV2: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/layer3org/spiritswap-v2',
      factoryAddress: '0x9d3591719038752db0c8bEEe2040FfcC3B2c6B9c',
      router: '0x93d2611EB8b85bE4FDEa9D94Ce9913D90072eC0f',
      initCode:
        '0x5442fb448d86f32a7d2a9dc1a457e64bf5a6c77415d98802aac4fb5a9dc5ecd9',
      // updatable fees on the pool contract without event
      stableFee: 4, // 10000 / 2500 = 4 in BPS
      volatileFee: 18, // ceil(10000 / 556) = 18 in BPS
      poolGasCost: 180 * 1000,
      feeCode: 4,
    },
  },
  Velodrome: {
    [Network.OPTIMISM]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/dmihal/velodrome',
      factoryAddress: '0x25cbddb98b35ab1ff77413456b31ec81a6b6b746',
      router: '0xa2f581b012E0f2dcCDe86fCbfb529f4aC5dD4983',
      initCode:
        '0xc1ac28b1c4ebe53c0cff67bab5878c4eb68759bb1e9f73977cd266b247d149f0',
      // updatable fees on the factory without event
      stableFee: 2,
      volatileFee: 2,
      poolGasCost: 180 * 1000,
      feeCode: 2,
    },
  },
  VelodromeV2: {
    [Network.OPTIMISM]: {
      // There is no subgraph for VelodromeV2
      factoryAddress: '0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a',
      router: '0xa2f581b012E0f2dcCDe86fCbfb529f4aC5dD4983',
      initCode:
        '0x1a8f01f7eab324003d9388f229ea17991eee9c9d14586f429799f3656790eba0',
      poolGasCost: 180 * 1000,
      feeCode: 0,
    },
  },
  Cone: {
    [Network.BSC]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/cone-exchange/cone',
      factoryAddress: '0x0EFc2D2D054383462F2cD72eA2526Ef7687E1016',
      router: '0xc2b5a8082D2E1867A9CBBF41b625E3ae9dF81f8b',
      initCode:
        '04b89f6ddaef769d145acd66e1700a76b1b7c369dfe9558e67ed6495b3b93fe4',
      // Variable fees. Defaults:
      // Stable: 10000 (0,01%) ('1' in uniswap)
      // Volatile: 2000 (0,05%) ('5' in uniswap)
      poolGasCost: 180 * 1000,
      feeCode: 0, // variable
    },
  },
  Thena: {
    [Network.BSC]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/thenaursa/thena-v1',
      factoryAddress: '0xAFD89d21BdB66d00817d4153E055830B1c2B3970',
      router: '0xc2b5a8082D2E1867A9CBBF41b625E3ae9dF81f8b',
      initCode:
        '0x8d3d214c094a9889564f695c3e9fa516dd3b50bc3258207acd7f8b8e6b94fb65',
      stableFee: 1, // 10000 / 10000 = 1 in BPS
      volatileFee: 20, // 10000 / 500 = 20 in BPS
      poolGasCost: 180 * 1000,
      feeCode: 1,
    },
  },
  SoliSnek: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/solisnek-finance/solisnek-avalanche',
      factoryAddress: '0xeeee1F1c93836B2CAf8B9E929cb978c35d46657E',
      router: '0x609AcD8Fc955Dd7E744c7DFFc9930a7A6654DE43',
      initCode:
        '0x79cda3bba5402e92f13ed1967c06033e6b7a1bc8d2e1d013b29fa0c4d0a4aa0f',
      // updatable fees on the factory without event
      stableFee: 2,
      volatileFee: 20,
      poolGasCost: 180 * 1000,
      feeCode: 2,
    },
  },
  Chronos: {
    [Network.ARBITRUM]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/xliee/chronos',
      factoryAddress: '0xce9240869391928253ed9cc9bcb8cb98cb5b0722',
      router: '0xb2634B3CBc1E401AB3C2743DB44d459C5c9aA662',
      initCode:
        '0x1840ae455256f509042de907fe0623f2e5e0ad44751ef974c4c37c1e516b7644',
      poolGasCost: 180 * 1000,
      feeCode: 0,
    },
  },
  Ramses: {
    [Network.ARBITRUM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/ramsesexchange/api-subgraph',
      factoryAddress: '0xAAA20D08e59F6561f242b08513D36266C5A29415',
      router: '0xb2634B3CBc1E401AB3C2743DB44d459C5c9aA662',
      initCode:
        '0x1565b129f2d1790f12d45301b9b084335626f0c92410bc43130763b69971135d',
      poolGasCost: 180 * 1000,
      feeCode: 0,
    },
  },
  Equalizer: {
    [Network.FANTOM]: {
      factoryAddress: '0xc6366EFD0AF1d09171fe0EBF32c7943BB310832a',
      router: '0x93d2611EB8b85bE4FDEa9D94Ce9913D90072eC0f',
      initCode:
        '0x02ada2a0163cd4f7e0f0c9805f5230716a95b174140e4c84c14883de216cc6a3',
      feeCode: 0,
      poolGasCost: 180 * 1000,
    },
  },
  Fvm: {
    [Network.FANTOM]: {
      factoryAddress: '0x472f3C3c9608fe0aE8d702f3f8A2d12c410C881A',
      router: '0x93d2611EB8b85bE4FDEa9D94Ce9913D90072eC0f',
      initCode:
        '0xac4013aa7118234c1dd1f9cc4cdd3933d5a426224bc691c1bde3d8930a7e6151', // PairFactory.pairCodeHash
      feeCode: 0, // dynamic fees
      poolGasCost: 180 * 1000, // just same as other forks
      // no subgraph
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 3 }], // dystopia
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 10 }], // solidly + spiritSwapV2 + Equalizer + Fvm
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [{ name: 'OptimismAdapter01', index: 8 }], // velodrome
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter02', index: 1 }], // thena + cone
  },
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter04', index: 1 }], // solidly
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter02', index: 3 }], // solisnek
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter02', index: 1 }], // chronos, ramses
  },
};
