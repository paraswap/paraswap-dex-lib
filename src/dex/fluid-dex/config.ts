import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const FluidDexConfig: DexConfigMap<DexParams> = {
  FluidDex: {
    [Network.MAINNET]: {
      pools: [
        {
          id: 'FluidDex_0x6d83f60eeac0e50a1250760151e81db2a278e03a', // Pool identifier: `{dex_key}_{pool_address}`
          address: '0x6d83f60eeac0e50a1250760151e81db2a278e03a', // Address of the pool
          debtOperations: '0xaf19a6f318b7f8f58c9f9c89acc1ec40a3afcdf5',
          colOperations: '0x835a8e10e8f473174f937afa0ec22fc9a7fa504f',
          perfectOperationsAndSwapOut:
            '0x8cf39e1bd5722baac7056e1a02ee139296b224ed',
          liquidityUserModule: '0x8ec5e29ea39b2f64b21e32cb9ff11d5059982f8c',
          resolver: '0x278166a9b88f166eb170d55801be1b1d1e576330',
          token0: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0', // wstETH
          token1: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
        },
      ],
    },
  },
};

export const FLUID_DEX_GAS_COST = 160_000;

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
