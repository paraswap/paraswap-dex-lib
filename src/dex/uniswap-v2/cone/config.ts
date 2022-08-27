import { AdapterMappings, DexConfigMap } from '../../../types';
import { DexParams } from '../types';
import { Network, SwapSide } from '../../../constants';

export const ConeConfig: DexConfigMap<DexParams> = {
  Cone: {
    [Network.BSC]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/cone-exchange/cone',
      factoryAddress: '0x0EFc2D2D054383462F2cD72eA2526Ef7687E1016',
      // ParaSwap-compatible Router with stable pools support
      router: '0x69a457CD13Ee72b0CA1b483aB17C36D80a23422f',
      initCode:
        '04b89f6ddaef769d145acd66e1700a76b1b7c369dfe9558e67ed6495b3b93fe4',
      feeCode: 5,
      poolGasCost: 180 * 1000,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 3 }],
  },
};
