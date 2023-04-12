import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const SwaapV2Config: DexConfigMap<DexParams> = {
  SwaapV2: {
    [Network.POLYGON]: {
      routerAddress: '0xC021C14D5D6A2B790F8B30DC34a211DD2C62E17F',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
