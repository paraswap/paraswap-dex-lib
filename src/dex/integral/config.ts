import { DexParams } from './types';
import { DexConfigMap, AdapterMappings, Token, Address } from '../../types';
import { Network } from '../../constants';

export const IntegralConfig: DexConfigMap<DexParams> = {
  Integral: {
    [Network.MAINNET]: {
      relayerAddress: '0x568723F044B1e1e24F7058bCDEaA3CC1387FBb42',
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/integralhq/integral-size',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
