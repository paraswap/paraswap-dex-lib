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
};
