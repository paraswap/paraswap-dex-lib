import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const FluidDexConfig: DexConfigMap<DexParams> = {
  FluidDex: {
    [Network.MAINNET]: {
      commonAddresses: {
        liquidityProxy: '0x52aa899454998be5b000ad077a46bbe360f4e497',
        resolver: '0x90bfebd5ac2d6787028dc8a58d0b5ee07b16e06f',
        dexFactory: '0xf9b539cd37fc81bbea1f078240d16b988bbae073',
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
