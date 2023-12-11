import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MAX_POOL_CNT = 1000;
export const POOL_CACHE_TTL = 60 * 60; // 1hr

export const DodoV3Config: DexConfigMap<DexParams> = {
  DodoV3: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.studio.thegraph.com/query/46336/dodoex_d3mm_eth/version/latest',
      D3Proxy: '0x411ec324598EF53b1E8663e335e9094464523e6B',
      D3Vault: '0x49186E32fEd50fd6B5604A2618c7B0b03Cd41414',
    },
    [Network.BSC]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/yongjun925/dodoex_d3mm_bsc',
      D3Proxy: '0x8fb36F4CF67EF12Cc0b63CF951ca0b4f9a8F1953',
      D3Vault: '0x3f4eF3763E0b6edB2b3237e29BD7e23Bd168bD46',
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.studio.thegraph.com/query/46336/dodoex_d3mm_polygon/version/latest',
      D3Proxy: '0x1c29eFa924770154fD44569c5B2bF8103feA45A1',
      D3Vault: '0x224fEce8104771478a3A4CE6D92ab1538d3659ee',
    },
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.studio.thegraph.com/query/2860/dodoex_d3mm_avax/version/latest',
      D3Proxy: '0xa71415675F68f29259ddD63215E5518d2735bf0a',
      D3Vault: '0xEAC4BFef7D1c872Ed705B01856af7f9802adC596',
    },
    [Network.ARBITRUM]: {
      subgraphURL:
        'https://api.studio.thegraph.com/query/46336/dodoex_d3mm_arbitrum/version/latest',
      D3Proxy: '0xbe9ec3C4825D87d77E0F049aA586449cF1d1E31b',
      D3Vault: '0xBAf350b14ed48429A7772F7D05B2CFc6620744D9',
    },
    [Network.OPTIMISM]: {
      subgraphURL:
        'https://api.studio.thegraph.com/query/2860/dodoex_d3mm_optimism/version/latest',
      D3Proxy: '0xCb3dC90E800C961d4a206BeAAFd92A6d2E06495e',
      D3Vault: '0x0fcB5237A1997C4700Ffa2BB4522EA38d4F851Fc',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: '',
        index: 0,
      },
    ],
  },
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

export const SUBGRAPH_FETCH_TOP_POOOLS_RQ = `query Pools($where: Pool_filter, $first: Int) {
  pools(where: $where, orderBy: totalAssetsUSD, orderDirection: desc, first: $first) {
    id
    blockNumber
    totalAssetsUSD
    tokenList {
      token {
        symbol
        id
        decimals
      }
    }
  }
}`;
