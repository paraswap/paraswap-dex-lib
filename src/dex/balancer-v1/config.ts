import { Network, SwapSide } from '../../constants';
import { DexConfigMap } from '../../types';
import { DexParams } from './types';

export const Config: DexConfigMap<DexParams> = {
  BalancerV1: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer',
    },
  },
};

export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter01',
        index: 5,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BuyAdapter',
        index: 4,
      },
    ],
  },
};
