import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { SwapSide } from 'paraswap-core';

// These are required to filter out log calls from the event calls
export const LogCallTopics = [
  '0xb02f0b7300000000000000000000000000000000000000000000000000000000',
  '0x5db3427700000000000000000000000000000000000000000000000000000000',
  '0x46ab38f100000000000000000000000000000000000000000000000000000000',
  '0x4f69c0d400000000000000000000000000000000000000000000000000000000',
  '0x8201aa3f00000000000000000000000000000000000000000000000000000000',
  '0x7c5e9ea400000000000000000000000000000000000000000000000000000000',
  '0x34e1990700000000000000000000000000000000000000000000000000000000',
  '0x49b5955200000000000000000000000000000000000000000000000000000000',
  '0x4bb278f300000000000000000000000000000000000000000000000000000000',
  '0x3fdddaa200000000000000000000000000000000000000000000000000000000',
  '0xe4e1e53800000000000000000000000000000000000000000000000000000000',
  '0xcf5e7bd300000000000000000000000000000000000000000000000000000000',
  '0x02c9674800000000000000000000000000000000000000000000000000000000',
];

export const BALANCER_SWAP_GAS_COST = 120 * 1000;

export const poolUrls: { [key: number]: string } = {
  [Network.MAINNET]:
    'https://storageapi.fleek.co/balancer-bucket/balancer-exchange/pools',
};

export const defaultfactoryAddress =
  '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd';
export const defaultMulticallAddress =
  '0x514053acec7177e277b947b1ebb5c08ab4c4580e';

export const POOL_FETCH_TIMEOUT = 5000;

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
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter01', index: 5 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 4 }],
  },
};
