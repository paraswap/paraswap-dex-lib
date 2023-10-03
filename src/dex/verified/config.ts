import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const VerifiedConfig: DexConfigMap<DexParams> = {
  Verified: {
    // TODO: complete me!
    [Network.GEORLI]: {
      vaultAddress: 'ikkk',
      subGraph: 'hh',
    },
    [Network.POLYGON]: {
      vaultAddress: 'i',
      subGraph: 'oo',
    },
    [Network.GNOSIS]: {
      vaultAddress: 'uu',
      subGraph: 'ju',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
