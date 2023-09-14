import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const SolidlyV3Config: DexConfigMap<DexParams> = {
  SolidlyV3: {
    [Network.MAINNET]: {
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
