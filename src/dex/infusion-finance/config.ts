import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const InfusionFinanceConfig: DexConfigMap<DexParams> = {
  InfusionFinance: {
    [Network.BASE]: {
      subgraphURL:
        'https://api.goldsky.com/api/public/project_clvn0ei0x2qro0130fpihh83o/subgraphs/infusion-subgraph/1.0.0/gn',
      factoryAddress: '0x2D9A3a2bd6400eE28d770c7254cA840c82faf23f',
      router: '0x1E891C9F96DcA29Da8B97bE3403D16135EBe8028',
      initCode:
        '0x57ae84018c47ebdaf7ddb2d1216c8c36389d12481309af65428eb6d460f747a4',
      // Fixed Fees, same for volatile and stable pools
      feeCode: 1,
      poolGasCost: 180 * 1000,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BASE]: {
    [SwapSide.SELL]: [{ name: 'BaseAdapter01', index: 3 }], // aerodrome, equalizer, velocimeter
  },
};
