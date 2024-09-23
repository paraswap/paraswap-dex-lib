import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const FluidDexConfig: DexConfigMap<DexParams> = {
  FluidDex: {
    [Network.MAINNET]: {
      pools: [
        {
          id: 'FluidDex_0x6d83f60eEac0e50A1250760151E81Db2a278e03a', // Pool identifier: `{dex_key}_{pool_address}`
          address: '0x6d83f60eEac0e50A1250760151E81Db2a278e03a', // Address of the pool
          token0: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', // wstETH
          token1: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
        },
      ],
    },
  },
};

export const FLUID_DEX_GAS_COST = 80_000;

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
