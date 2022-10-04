import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const POOLS_FETCH_TIMEOUT = 10000;
export const BALANCES_MULTICALL_POOLS_LIMIT = 200;
export const MAX_POOLS_FOR_PRICING = 5;
export const BALANCER_SWAP_GAS_COST = 120 * 1000;

export const BalancerV1Config: DexConfigMap<DexParams> = {
  BalancerV1: {
    [Network.MAINNET]: {
      poolsURL:
        'https://storageapi.fleek.co/balancer-bucket/balancer-exchange/pools',
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer',
      exchangeProxy: '0x6317c5e82a06e1d8bf200d21f4510ac2c038ac81',
      multicallAddress: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter01', index: 5 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 4 }],
  },
};
