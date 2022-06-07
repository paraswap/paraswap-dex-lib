import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const UniswapV3Config: DexConfigMap<DexParams> = {
  UniswapV3: {
    [Network.MAINNET]: {
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    },
    [Network.POLYGON]: {
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
