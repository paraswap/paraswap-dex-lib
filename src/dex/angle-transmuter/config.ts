import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AngleTransmuterConfig: DexConfigMap<DexParams> = {
  AngleTransmuter: {
    [Network.MAINNET]: {
      agEUR: {
        address: '0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8',
        decimals: 18,
      },
      transmuter: '0x00253582b2a3FE112feEC532221d9708c64cEFAb',
      pyth: '0x4305FB66699C3B2702D4d05CF36551390A4c69C6',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
