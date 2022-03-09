import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

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
  },
  BeetsFi: {
    [Network.FANTOM]: {
      subgraphURL:
        'https://graph-node.beets-ftm-node.com/subgraphs/name/beethovenx',
      vaultAddress: '0x20dd72ed959b6147912c2e529f0a0c651c33c9ce',
    },
  },
  Embr: {
    [Network.AVALANCHE]: {
      subgraphURL:
        'https://node-us.embr.finance/subgraphs/name/embrfinance/embr-avalanche-v2',
      vaultAddress: '0xad68ea482860cd7077a5D0684313dD3a9BC70fbB',
    },
  },
};

export const Adapters: {
  [chainId: number]: { name: string; index: number }[];
} = {
  [Network.MAINNET]: [
    {
      name: 'Adapter02',
      index: 9,
    },
  ],
  [Network.POLYGON]: [
    {
      name: 'PolygonAdapter01',
      index: 9,
    },
  ],
  [Network.FANTOM]: [
    {
      name: 'FantomAdapter01',
      index: 5,
    },
  ],
};
