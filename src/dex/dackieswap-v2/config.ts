import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const DackieswapV2Config: DexConfigMap<DexParams> = {
  DackieswapV2: {
    [Network.BASE]: {
      // There is no subgraph for Aerodrome
      factoryAddress: '0x591f122D1df761E616c13d265006fcbf4c6d6551',
      router: '0xCa4EAa32E7081b0c4Ba47e2bDF9B7163907Fe56f',
      initCode:
        '0xaaaacde43ad77b69fcbcdc68ccb757c3c634ad20e330a951b4a267f1180c6520',
      poolGasCost: 180 * 1000,
      feeCode: 0,
      subgraphURL:
        'https://api.studio.thegraph.com/query/50473/subgraphs-exchange-v2/version/latest',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BASE]: {
    [SwapSide.SELL]: [{ name: 'BaseAdapter01', index: 1 }], // dackieswap-v2
  },
};
