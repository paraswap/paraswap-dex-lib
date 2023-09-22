import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const BalancerConfig: DexConfigMap<DexParams> = {
  BalancerV2: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    },
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2',
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    },
    [Network.ARBITRUM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-arbitrum-v2',
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    },
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-avalanche-v2',
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    }
  },
  BeetsFi: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/beethovenxfi/beethovenx',
      vaultAddress: '0x20dd72ed959b6147912c2e529f0a0c651c33c9ce',
    },
    [Network.OPTIMISM]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/beethovenxfi/beethovenx-optimism',
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    },
  },
  // There is almost no liquidity: <12k$. Do not re-enable if protocol is not revived
  // Embr: {
  //  [Network.AVALANCHE]: {
  //    subgraphURL:
  //       'https://api.thegraph.com/subgraphs/name/embrfinance/embr-avalanche-v2',
  //    vaultAddress: '0xad68ea482860cd7077a5D0684313dD3a9BC70fbB',
  //  },
  // },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter02', index: 9 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 9 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 9 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 6 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 5 }],
    [SwapSide.BUY]: [{ name: 'FantomBuyAdapter', index: 4 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 5 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 6 }],
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [{ name: 'OptimismAdapter01', index: 4 }],
    [SwapSide.BUY]: [{ name: 'OptimismBuyAdapter', index: 5 }],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 8 }],
    [SwapSide.BUY]: [{ name: 'AvalancheBuyAdapter', index: 7 }],
  },
  [Network.BASE]: {
    [SwapSide.SELL]: [{ name: 'BaseAdapter01', index: 4 }],
    [SwapSide.BUY]: [{ name: 'BaseBuyAdapter', index: 3 }],
  }
};
