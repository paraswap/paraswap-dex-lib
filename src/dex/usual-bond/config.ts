import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const UsualBondConfig: DexConfigMap<DexParams> = {
  UsualBond: {
    [Network.MAINNET]: {
      usd0Address: '0x73A15FeD60Bf67631dC6cd7Bc5B6e8da8190aCF5',
      usd0ppAddress: '0x35D8949372D46B7a3D5A56006AE77B215fc69bC0',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
