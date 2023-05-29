import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Address } from '../../types';

const SUPPORTED_FEES = [1500n];

// Pools that will be initialized on app startup
// They are added for testing
export const PoolsToPreload: DexConfigMap<
  { token0: Address; token1: Address }[]
> = {
  DfynV2: {
    [Network.POLYGON]: [
      {
        token0: '0x16ECCfDbb4eE1A85A33f3A9B21175Cd7Ae753dB4'.toLowerCase(),
        token1: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(),
      },
      {
        token0: '0xC168E40227E4ebD8C1caE80F7a55a4F0e6D66C97'.toLowerCase(),
        token1: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(),
      },
    ],
    [Network.ARBITRUM]: [
      {
        token0: '0x11BbF12363dC8375b78D2719395d505f52a02F68'.toLowerCase(),
        token1: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'.toLowerCase(),
      },
      {
        token0: '0x13538f1450Ca2E1882Df650F87Eb996fF4Ffec34'.toLowerCase(),
        token1: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'.toLowerCase(),
      },
    ],
  },
};

export const DfynV2Config: DexConfigMap<DexParams> = {
  DfynV2: {
    [Network.POLYGON]: {
      factory: '0xf79a83E3f8E853D9658e8b97a83942Af80d45b85',
      quoter: '0xeE4545ABC69C17Bbc48971E4be98D35626Bd8793',
      router: '0x791d56d007AF3bD9a62c1a938444282EE3124e0c',
      supportedFees: SUPPORTED_FEES,
      poolHelper: '0x02dE9a2031ac7E53e5170236C8857659aB915db8',
      dfynMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      DFYNV2_SUBGRAPH_URL: 'https://api.thegraph.com/subgraphs/name/jdrouterp/dfyn-concentrated-pools',
      DEFAULT_POOL_INIT_CODE_HASH: '0x1a7e5ef1e1989c411ffc5bd046a9f78d9f197278d7205be2531e46a142074f42'
    },
    [Network.ARBITRUM]: {
      factory: '0xe79D5E1A7b52EcFa91fd2F910e6B884C0C5CDd28',
      quoter: '0xaC304289074EAfBb884271d51E8948751E93e25B',
      router: '0x7e46C3fe38a71E79dD9908a8C8897A9c499F7bB7',
      supportedFees: SUPPORTED_FEES,
      poolHelper: '0x06262375Ec3b8D199052e48444884B9B18BB57e9',
      dfynMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
      DFYNV2_SUBGRAPH_URL:'https://subgraph.satsuma-prod.com/57a2c796086f/dfyn/arbitrum-pools-farms/api',
      DEFAULT_POOL_INIT_CODE_HASH: '0xd3860d662c4ed0e0367318c115707403d931d6220638a12dbbed06c6716e413d'
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 13 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 2 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 13 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 2 }],
  },
};
