import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const FluidDexConfig: DexConfigMap<DexParams> = {
  FluidDex: {
    [Network.MAINNET]: {
      commonAddresses: {
        liquidityProxy: '0x52aa899454998be5b000ad077a46bbe360f4e497',
        resolver: '0xb387f9C2092cF7c4943F97842887eBff7AE96EB3',
        dexFactory: '0x91716C4EDA1Fb55e84Bf8b4c7085f84285c19085',
      },
    },
    [Network.ARBITRUM]: {
      commonAddresses: {
        liquidityProxy: '0x52Aa899454998Be5b000Ad077a46Bbe360F4e497',
        resolver: '0xCe6F4E40152a1DF97ae95a7e4F60D944871A4060',
        dexFactory: '0x91716C4EDA1Fb55e84Bf8b4c7085f84285c19085',
      },
    },
    [Network.POLYGON]: {
      commonAddresses: {
        liquidityProxy: '0x52Aa899454998Be5b000Ad077a46Bbe360F4e497',
        resolver: '0xA508fd16Bf3391Fb555cce478C616BDe4a613052',
        dexFactory: '0x91716C4EDA1Fb55e84Bf8b4c7085f84285c19085',
      },
    },
  },
};

// Uniswap takes total gas of 125k = 21k base gas & 104k swap (this is when user has token balance)
// Fluid takes total gas of 175k = 21k base gas & 154k swap (this is when user has token balance),
// with ETH swaps costing less (because no WETH conversion)
export const FLUID_DEX_GAS_COST = 154_000;
