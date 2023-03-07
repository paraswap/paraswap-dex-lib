import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MaverickV1Config: DexConfigMap<DexParams> = {
  MaverickV1: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://gateway.thegraph.com/api/4b42aaaee3e81a3f29390e9df7010cbc/subgraphs/id/Ccu7XxsbU7SS4VfNfmy6YRBCbNrGYpKYpBEfxzy5Fkr1',
      routerAddress: '0x4a585e0f7c18e2c414221d6402652d5e0990e5f8',
      poolInspectorAddress: '0xaA5BF61a664109e959D69C38734d4EA7dF74e456',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: 'Adapter04', index: 2 }] },
};
