import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { SwapSide } from 'paraswap-core';

export const BalancerV1Config: DexConfigMap<DexParams> = {
  BalancerV1: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[];
  };
} = {
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: 'Adapter01', index: 5 }] },
};
