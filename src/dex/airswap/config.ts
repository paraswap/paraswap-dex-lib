import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AirSwapConfig: DexConfigMap<DexParams> = {
  AirSwap: {
    [Network.MAINNET]: {},
    [Network.BSC]: {},
    [Network.POLYGON]: {},
    [Network.ARBITRUM]: {},
    [Network.AVALANCHE]: {},
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // @TODO - PARASWAP
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
