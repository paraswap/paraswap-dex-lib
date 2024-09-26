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
          debtOperations: '0xaf19a6F318b7F8f58c9F9C89Acc1eC40a3AFcdF5',
          colOperations: '0x835a8E10e8F473174F937AFA0eC22fC9a7Fa504F',
          perfectOperationsAndSwapOut:
            '0x8Cf39E1bD5722BAaC7056E1A02eE139296B224ED',
          liquidityUserModule: '0x8eC5e29eA39b2f64B21e32cB9Ff11D5059982F8C',
          resolver: '0xfE1CBE632855e279601EaAF58D3cB552271BfDF5',
          token0: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', // wstETH
          token1: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
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
