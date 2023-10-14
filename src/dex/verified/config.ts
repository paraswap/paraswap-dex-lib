import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const VerifiedConfig: DexConfigMap<DexParams> = {
  Verified: {
    // TODO: complete me!
    [Network.GEORLI]: {
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      subGraphUrl:
        'https://api.thegraph.com/subgraphs/name/verified-network/balancer',
    },
    [Network.POLYGON]: {
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      subGraphUrl:
        'https://api.thegraph.com/subgraphs/name/verified-network/vault-matic',
    },
    [Network.GNOSIS]: {
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      subGraphUrl:
        'https://api.thegraph.com/subgraphs/name/verified-network/vault-gnosis',
    },
  },
  //To handle e2e.test error it keep using BalancerV2 as dexkey even though Verified was passed
  BalancerV2: {
    // TODO: complete me!
    [Network.GEORLI]: {
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      subGraphUrl:
        'https://api.thegraph.com/subgraphs/name/verified-network/balancer',
    },
    [Network.POLYGON]: {
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      subGraphUrl:
        'https://api.thegraph.com/subgraphs/name/verified-network/vault-matic',
    },
    [Network.GNOSIS]: {
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      subGraphUrl:
        'https://api.thegraph.com/subgraphs/name/verified-network/vault-gnosis',
    },
  },
};

export const _VerifiedConfig: DexConfigMap<DexParams> = {
  Verified: {
    // TODO: complete me!
    [Network.GEORLI]: {
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      subGraphUrl:
        'https://api.thegraph.com/subgraphs/name/verified-network/balancer',
    },
    [Network.POLYGON]: {
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      subGraphUrl:
        'https://api.thegraph.com/subgraphs/name/verified-network/vault-matic',
    },
    [Network.GNOSIS]: {
      vaultAddress: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      subGraphUrl:
        'https://api.thegraph.com/subgraphs/name/verified-network/vault-gnosis',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
