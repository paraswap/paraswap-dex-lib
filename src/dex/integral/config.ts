import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network } from '../../constants';

export const IntegralConfig: DexConfigMap<DexParams> = {
  Integral: {
    [Network.MAINNET]: {
      relayerAddress: '0xd17b3c9784510E33cD5B87b490E79253BcD81e2E',
      subgraphURL: 'ANd5QJuYtyfngmXvBMu9kZAv935vhcqp4xAGBkmCADN3',
    },
    [Network.ARBITRUM]: {
      relayerAddress: '0x3c6951FDB433b5b8442e7aa126D50fBFB54b5f42',
      subgraphURL: 'HXeVedRK7VgogXwbK5Sc4mjyLkhBAS5akskRvbSYnkHU',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
