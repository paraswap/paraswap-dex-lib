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
};
