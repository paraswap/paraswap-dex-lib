import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const FluidDexConfig: DexConfigMap<DexParams> = {
  FluidDex: {
    [Network.MAINNET]: {
      commonAddresses: {
        liquidityProxy: '0x52aa899454998be5b000ad077a46bbe360f4e497',
        resolver: '0xE8a07a32489BD9d5a00f01A55749Cf5cB854Fd13',
        dexFactory: '0x91716C4EDA1Fb55e84Bf8b4c7085f84285c19085',
      },
      pools: [],
    },
  },
};

// Uniswap takes total gas of 125k = 21k base gas & 104k swap (this is when user has token balance)
// Fluid takes total gas of 175k = 21k base gas & 154k swap (this is when user has token balance),
// with ETH swaps costing less (because no WETH conversion)
export const FLUID_DEX_GAS_COST = 154_000;

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    // TODO: set index?
    [SwapSide.SELL]: [{ name: 'Adapter03', index: 0 }],
  },
};
