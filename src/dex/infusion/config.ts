import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const InfusionConfig: DexConfigMap<DexParams> = {
  Infusion: {
    [Network.BASE]: {
      subgraphURL:
        'https://api.goldsky.com/api/public/project_clvn0ei0x2qro0130fpihh83o/subgraphs/infusion-subgraph/1.0.0/gn',
      factoryAddress: '0x2D9A3a2bd6400eE28d770c7254cA840c82faf23f',
      router: '0x1E891C9F96DcA29Da8B97bE3403D16135EBe8028',
      initCode:
        '0xc1ac28b1c4ebe53c0cff67bab5878c4eb68759bb1e9f73977cd266b247d149f0',
      // updatable fees on the factory without event
      stableFee: 2,
      volatileFee: 2,
      poolGasCost: 180 * 1000,
      feeCode: 2,
    },
  },
};
