import { DexParams } from './types';
import { DexConfigMap, Address } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MaverickConfig: DexConfigMap<DexParams> = {
  Maverick: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/maverickprotocol/swap-polygon',
      factoryAddress: '0x08da5c7f95681D925D807b90E8AB67c2e10bD044',
      routerAddress: '0x66a66a816a43Fc63BBaaF4b8f7210A19c8E32dB8',
      estimatorAddress: '0x2718A216057EA4ef6D5FfA46B2Fa4E8d0F608b06',
    },
  },
};

export const Adapters: {
  [chainId: number]: { name: string; index: number }[];
} = {};
