import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AirSwapConfig: DexConfigMap<DexParams> = {
  AirSwap: {},
};

export const Adapters: Record<number, AdapterMappings> = {
  // @TODO - PARASWAP
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
