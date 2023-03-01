import { DexParams } from './types';
import { DexConfigMap, AdapterMappings, Token, Address } from '../../types';
import { Network } from '../../constants';

export const IntegralConfig: DexConfigMap<DexParams> = {
  Integral: {
    [Network.MAINNET]: {
      relayerAddress: '0xd17b3c9784510E33cD5B87b490E79253BcD81e2E',
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/integralhq/integral-size',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
