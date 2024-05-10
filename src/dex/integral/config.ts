import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network } from '../../constants';

export const IntegralConfig: DexConfigMap<DexParams> = {
  Integral: {
    [Network.MAINNET]: {
      factoryAddress: '0xC480b33eE5229DE3FbDFAD1D2DCD3F3BAD0C56c6',
      relayerAddress: '0xd17b3c9784510E33cD5B87b490E79253BcD81e2E',
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/integralhq/integral-size',
    },
    [Network.ARBITRUM]: {
      factoryAddress: '0x717EF162cf831db83c51134734A15D1EBe9E516a',
      relayerAddress: '0x3c6951FDB433b5b8442e7aa126D50fBFB54b5f42',
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/integralhq/integral-size-arbitrum',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
