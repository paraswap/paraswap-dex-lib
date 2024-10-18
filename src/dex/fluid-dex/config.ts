import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const FluidDexConfig: DexConfigMap<DexParams> = {
  FluidDex: {
    [Network.MAINNET]: {
      commonAddresses: {
        liquidityProxy: '0x52aa899454998be5b000ad077a46bbe360f4e497',
        resolver: '0x90bFebd5Ac2d6787028DC8A58d0b5EE07b16E06F',
        dexFactory: '0xF9b539Cd37Fc81bBEA1F078240d16b988BBae073',
      },
      pools: [],
    },
  },
};

export const FLUID_DEX_GAS_COST = 150_000;

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    // TODO: set index?
    [SwapSide.SELL]: [{ name: 'Adapter03', index: 0 }],
  },
};
