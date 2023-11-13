import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const LighterV2Config: DexConfigMap<DexParams> = {
  LighterV2: {
    [Network.ARBITRUM]: {
      factory: '0xDa66c2ADFAF2c524283Ff9e72Ef7702a254C9127',
      router: '0x86D4Ef07492605D30124E25B1E08E3C489D39807',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
