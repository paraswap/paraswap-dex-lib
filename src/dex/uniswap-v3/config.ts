import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Address } from '../../types';
import RamsesV2StateMulticallABI from '../../abi/RamsesV2StateMulticall.abi.json';
import VelodromeSlipstreamMulticallABi from '../../abi/velodrome-slipstream/VelodromeSlipstreamStateMulticall.abi.json';
import { AbiItem } from 'web3-utils';
import { decodeStateMultiCallResultWithRelativeBitmaps as decodeStateMultiCallResultWithRelativeBitmapsForRamses } from './forks/ramses-v2/utils';
import { decodeStateMultiCallResultWithRelativeBitmaps as decodeStateMultiCallResultWithRelativeBitmapsForVelodromeSlipstream } from './forks/velodrome-slipstream/utils';
import { RamsesV2EventPool } from './forks/ramses-v2/ramses-v2-pool';
import { VelodromeSlipstreamEventPool } from './forks/velodrome-slipstream/velodrome-slipstream-pool';
import { VelodromeSlipstreamFactory } from './forks/velodrome-slipstream/velodrome-slipstream-factory';

const SUPPORTED_FEES = [10000n, 3000n, 500n, 100n];
const RAMSES_FORKS_FEES = [...SUPPORTED_FEES, 50n, 250n];
const PANGOLIN_SUPPORTED_FEES = [8000n, 2500n, 500n, 100n];

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
      subgraphURL: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
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
      subgraphURL: 'F85MNzUGYqgSHSHRGgeVMNsdnW1KtZSVgFULumXRZTw2',
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
      subgraphURL: '3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm',
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
      subgraphURL: '89nD6JoQmeFcYLoimEDuNatWmQHAJsh9mm887XJXxWto',
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
      subgraphURL: '7SVwgBfXoWmiK6x1NF1VEo1szkeWLniqWN1oYsX3UMb5',
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
      subgraphURL: 'GVH9h9KZ9CqheUEL93qMbq7QwgoBu32QXQDPR6bev4Eo',
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
      subgraphURL: 'GqzP4Xaehti8KSfQmv3ZctFSjnSUYZ4En5NRsiTbvZpz',
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
      subgraphURL: '5nnoU1nUFeWqtXgbpC54L9PWdpgo7Y9HYinR3uTMsfzs',
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
      subgraphURL: 'CqLnQY1d6DLcBYu7aZvGmt17LoNdTe4fDYnGbE2EgotR',
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
      subgraphURL: 'FiJDXMFCBv88GP17g2TtPh8BcA8jZozn5WRW7hCN7cUT',
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
      subgraphURL: '4BxsTB5ADnYdgJgdmzyddmnDGCauctDia28uxB1hgTBE',
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
      subgraphURL: '4BzEvR229mwKjneCbJTDM8dsS3rjgoKcXt5C7J1DaUxK',
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
      subgraphURL: '96EYD64NqmnFxMELu2QLWB95gqCmA9N96ssYsZfFiYHg',
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
      subgraphURL: 'Dr3FkshPgTMMDwxckz3oZdwLxaPcbzZuAbE92i6arYtJ',
    },
    [Network.BASE]: {
      factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
      quoter: '0xb1E835Dc2785b52265711e17fCCb0fd018226a6e',
      router: '0xCc0e85901f33D375FcdD9a888B05Df9616F68277',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x7160f736c52e1e78e92FD4eE4D73e21A7Cf4F950',
      uniswapMulticall: '0x091e99cb1C49331a94dD62755D168E941AbD0693',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL: 'https://api.studio.thegraph.com/query/32073/v3-base/v0.0.1',
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
    },
  },
  RamsesV2: {
    [Network.ARBITRUM]: {
      factory: '0xAA2cd7477c451E703f3B9Ba5663334914763edF8',
      deployer: '0xb3e423ab9cE6C03D98326A3A2a0D7D96b0829f22',
      quoter: '0xAA20EFF7ad2F523590dE6c04918DaAE0904E3b20',
      router: '0xAA23611badAFB62D37E7295A682D21960ac85A90',
      supportedFees: RAMSES_FORKS_FEES,
      stateMulticall: '0x50EE4112Cab9c79812F23bE079aB3911395ACc8e',
      stateMultiCallAbi: RamsesV2StateMulticallABI as AbiItem[],
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      eventPoolImplementation: RamsesV2EventPool,
      decodeStateMultiCallResultWithRelativeBitmaps:
        decodeStateMultiCallResultWithRelativeBitmapsForRamses,
      initHash:
        '0x1565b129f2d1790f12d45301b9b084335626f0c92410bc43130763b69971135d',
      subgraphURL: 'G2tXDm6mgqBMuC7hq9GRVeTv5SRBAVnPFGcpGBab2cea',
    },
  },
  PharaohV2: {
    [Network.AVALANCHE]: {
      factory: '0xAAA32926fcE6bE95ea2c51cB4Fcb60836D320C42',
      deployer: '0x95120704f4E2D545Aea8b6B3c16d9Da1fa32E30F',
      quoter: '0xAAAEA10b0e6FBe566FE27c3A023DC5D8cA6Bca3d',
      router: '0xAAAE99091Fbb28D400029052821653C1C752483B',
      supportedFees: RAMSES_FORKS_FEES,
      stateMulticall: '0xd32C191e0febaa6Cc93A29Cb676474c72486E00b',
      stateMultiCallAbi: RamsesV2StateMulticallABI as AbiItem[],
      uniswapMulticall: '0x0139141Cd4Ee88dF3Cdb65881D411bAE271Ef0C2',
      chunksCount: 10,
      initRetryFrequency: 10,
      eventPoolImplementation: RamsesV2EventPool,
      decodeStateMultiCallResultWithRelativeBitmaps:
        decodeStateMultiCallResultWithRelativeBitmapsForRamses,
      initHash:
        '0x1565b129f2d1790f12d45301b9b084335626f0c92410bc43130763b69971135d',
      subgraphURL:
        'https://api.studio.thegraph.com/query/66247/pharaoh-cl/version/latest',
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
      subgraphURL: 'E9PLkFzXVX1a9YFtLLyXmLV93ihAUFCvgrnrdnTrnFeN',
    },
  },
  SpookySwapV3: {
    [Network.FANTOM]: {
      factory: '0x7928a2c48754501f3a8064765ECaE541daE5c3E6',
      quoter: '0xB9507f2ED171D52c5c2EFaeAbdE440d264504A92',
      router: '0x765132A0630Cd4401b971706Bb21c0FB5Ab547ad',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x2cc482a66dd677ad33900018f774052717c533fb',
      uniswapMulticall: '0x96a7F0E4905F39508b17Faef5aC456C72a4E1319',
      chunksCount: 5,
      initRetryFrequency: 30,
      initHash:
        '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54',
      subgraphURL: '6WBxx3gYia4oCLsYMFTZs6HLEnEqVMdpeZDCABnM1tj2',
    },
  },
  Retro: {
    [Network.POLYGON]: {
      factory: '0x91e1B99072f238352f59e58de875691e20Dc19c1',
      quoter: '0xfe08be075758935cb6cb9318d1fbb60920416d4e',
      router: '0x1891783cb3497Fdad1F25C933225243c2c7c4102',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x6Dc993Fe1e945A640576B4Dca81281d8e998DF71',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0x817e07951f93017a93327ac8cc31e946540203a19e1ecc37bc1761965c2d1090`,
      subgraphURL: 'DZyDuvUHNThtJJQAEbYGr32xYc93BZAdfqatpYUNMZbe',
    },
  },
  BaseswapV3: {
    [Network.BASE]: {
      factory: '0x38015D05f4fEC8AFe15D7cc0386a126574e8077B',
      quoter: '0x4fDBD73aD4B1DDde594BF05497C15f76308eFfb9',
      router: '0x1B8eea9315bE495187D873DA7773a874545D9D48',
      supportedFees: [10000n, 2500n, 450n, 80n],
      stateMulticall: '0x7160f736c52e1e78e92FD4eE4D73e21A7Cf4F950',
      uniswapMulticall: '0x091e99cb1C49331a94dD62755D168E941AbD0693',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL: '39pzQzH5r3vmovd9fTs7rVDVFCj1xJye3dTMNHcSkSfL',
    },
  },
  AlienBaseV3: {
    [Network.BASE]: {
      factory: '0x0Fd83557b2be93617c9C1C1B6fd549401C74558C',
      quoter: '0x4fDBD73aD4B1DDde594BF05497C15f76308eFfb9',
      router: '0x79edabc464dcdce8cbf1b60c003aceef7e0282d9',
      supportedFees: [10000n, 3000n, 750n, 200n],
      stateMulticall: '0x7160f736c52e1e78e92FD4eE4D73e21A7Cf4F950',
      uniswapMulticall: '0x091e99cb1C49331a94dD62755D168E941AbD0693',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL: '6Cz9KkQ7mj4B3DCKorR4W9y72ice2wCTD2qU68tAhJnp',
    },
  },
  OkuTradeV3: {
    [Network.GNOSIS]: {
      factory: '0xe32f7dd7e3f098d518ff19a22d5f028e076489b1',
      quoter: '0x7E9cB3499A6cee3baBe5c8a3D328EA7FD36578f4',
      router: '0xB5253c895361678FF5D0fFDdA81Dd02f1F7a81D6',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x35Db9Ac2ff3C5A86fde165Bd26D43d303417942E',
      uniswapMulticall: '0x4dfa9a980efE4802E969AC33968E3d6E59B8a19e',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: `0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54`,
      subgraphURL: 'Dimv1udMsJu1DqirVM4G2vNRvH8CWzWTn7GffQQCGAaq',
    },
  },
  VelodromeSlipstreamNewFactory: {
    [Network.OPTIMISM]: {
      factory: '0xCc0bDDB707055e04e497aB22a59c2aF4391cd12F',
      quoter: '0x89D8218ed5fF1e46d8dcd33fb0bbeE3be1621466',
      router: '0x49e94895A26e697602c8270e437688514b291a81',
      supportedFees: SUPPORTED_FEES,
      tickSpacings: [1n, 50n, 100n, 200n, 2000n],
      tickSpacingsToFees: {
        '1': 100n,
        '50': 500n,
        '100': 500n,
        '200': 3000n,
        '2000': 10000n,
      },
      stateMulticall: '0xc055b23319b3a140D4De2d0001bd0A885B3d7DbB',
      stateMultiCallAbi: VelodromeSlipstreamMulticallABi as AbiItem[],
      eventPoolImplementation: VelodromeSlipstreamEventPool,
      factoryImplementation: VelodromeSlipstreamFactory,
      decodeStateMultiCallResultWithRelativeBitmaps:
        decodeStateMultiCallResultWithRelativeBitmapsForVelodromeSlipstream,
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: '0xc28ad28853a547556780bebf7847628501a3bcbb', // pool implementation address from factory contract is used instead of initHash here
    },
  },
  AerodromeSlipstream: {
    [Network.BASE]: {
      factory: '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A',
      quoter: '0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0',
      router: '0x1b2b6cE813b99b840Fe632c63bcA5394938Ef01e',
      supportedFees: SUPPORTED_FEES,
      tickSpacings: [1n, 10n, 50n, 100n, 200n, 2000n],
      tickSpacingsToFees: {
        '1': 100n,
        '10': 500n,
        '50': 500n,
        '100': 500n,
        '200': 3000n,
        '2000': 10000n,
      },
      stateMulticall: '0x736518161516c1cfBD5bf5e7049FCBDC9b933987',
      stateMultiCallAbi: VelodromeSlipstreamMulticallABi as AbiItem[],
      eventPoolImplementation: VelodromeSlipstreamEventPool,
      factoryImplementation: VelodromeSlipstreamFactory,
      decodeStateMultiCallResultWithRelativeBitmaps:
        decodeStateMultiCallResultWithRelativeBitmapsForVelodromeSlipstream,
      uniswapMulticall: '0x091e99cb1C49331a94dD62755D168E941AbD0693',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash: '0xeC8E5342B19977B4eF8892e02D8DAEcfa1315831', // pool implementation address from factory contract is used instead of initHash here
    },
  },
  PangolinV3: {
    [Network.AVALANCHE]: {
      factory: '0x1128F23D0bc0A8396E9FBC3c0c68f5EA228B8256',
      quoter: '0xA86522CCc412dBC4FA10991900FE46De95983822',
      router: '0x5485A0751a249225D3bA2f6f296551507e22547f',
      supportedFees: PANGOLIN_SUPPORTED_FEES,
      stateMulticall: '0x30F6B9b6485ff0B67E881f5ac80D3F1c70A4B23d',
      uniswapMulticall: '0x0139141Cd4Ee88dF3Cdb65881D411bAE271Ef0C2',
      chunksCount: 10,
      initRetryFrequency: 10,
      initHash:
        '0xa9bb1321d78097b23af97a9c07d5ec13e1adc404334585171c54ecccb5ad93b2',
      subgraphURL: 'EMnAvnfc1fwGSU6ToqYJCeEkXmSgmDmhwtyaha1tM5oi',
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
