import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AirSwapConfig: DexConfigMap<DexParams> = {
  AirSwap: {
    [Network.MAINNET]: {
      swap: '0xd82FA167727a4dc6D6F55830A2c47aBbB4b3a0F8',
      makerRegistry: '0x8F9DA6d38939411340b19401E8c54Ea1f51B8f95',
    },
    [Network.BSC]: {
      swap: '0xB1F80291d0EB60b75E7DF9422FB942d8FC575F4d',
      makerRegistry: '0xaBF694A434E0fE3b951409C01aa2db50Af4D2E3A',
    },
    [Network.POLYGON]: {
      swap: '0xDECA72bDA0cDf62d79b46B1585B380c9C6d57D9E',
      makerRegistry: '0x9F11691FA842856E44586380b27Ac331ab7De93d',
    },
    [Network.ARBITRUM]: {
      swap: '0x5E5A433cdfB14aB228c45E23251Ad83F7b1E3302',
      makerRegistry: '0xaBF694A434E0fE3b951409C01aa2db50Af4D2E3A',
    },
    [Network.AVALANCHE]: {
      swap: '0x5E5A433cdfB14aB228c45E23251Ad83F7b1E3302',
      makerRegistry: '0xE40feb39fcb941A633deC965Abc9921b3FE962b2',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // @TODO - PARASWAP
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
