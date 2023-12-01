import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MAX_POOL_CNT = 1000;
export const POOL_CACHE_TTL = 60 * 60; // 1hr

export const DodoV3Config: DexConfigMap<DexParams> = {
  DodoV3: {
    // [Network.MAINNET]: {
    //   subgraphURL:
    //     'https://api.studio.thegraph.com/query/46336/dodoex_d3mm_eth/version/latest',
    // },
    [Network.BSC]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/yongjun925/dodoex_d3mm_bsc',
      D3Vault: '0x3f4eF3763E0b6edB2b3237e29BD7e23Bd168bD46',
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.studio.thegraph.com/query/46336/dodoex_d3mm_polygon/version/latest',
      D3Vault: '0x224fEce8104771478a3A4CE6D92ab1538d3659ee',
    },
    // [Network.AVALANCHE]: {
    //   subgraphURL:
    //     'https://api.studio.thegraph.com/query/2860/dodoex_d3mm_avax/version/latest',
    // },
    [Network.ARBITRUM]: {
      subgraphURL:
        'https://api.studio.thegraph.com/query/46336/dodoex_d3mm_arbitrum/version/latest',
      D3Vault: '0xBAf350b14ed48429A7772F7D05B2CFc6620744D9',
    },
    // [Network.OPTIMISM]: {
    //   subgraphURL:
    //     'https://api.studio.thegraph.com/query/2860/dodoex_d3mm_optimism/version/latest',
    // },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};

export const SUBGRAPH_FETCH_ALL_POOOLS_RQ = `query Pools($where: Pool_filter, $first: Int) {
  pools(where: $where, orderBy: totalAssetsUSD, orderDirection: desc, first: $first) {
    id
    blockNumber
    totalAssetsUSD
    vault {
      id
    }
  }
}`;
