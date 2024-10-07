import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const FluidDexConfig: DexConfigMap<DexParams> = {
  FluidDex: {
    [Network.MAINNET]: {
      commonAddresses: {
        liquidityProxy: '0x52aa899454998be5b000ad077a46bbe360f4e497',
        resolver: '0x278166a9b88f166eb170d55801be1b1d1e576330',
        dexFactory: '0x93dd426446b5370f094a1e31f19991aaa6ac0be0',
      },
      pools: [],
    },
  },
};

export const FLUID_DEX_GAS_COST = 160_000;

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
