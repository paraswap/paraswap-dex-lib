import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AirSwapConfig: DexConfigMap<DexParams> = {
  AirSwap: {
    [Network.MAINNET]: {
      swapERC20: '0x522d6f36c95a1b6509a14272c17747bbb582f2a6',
      makerRegistry: '0x8F9DA6d38939411340b19401E8c54Ea1f51B8f95',
    },
    [Network.BSC]: {
      swapERC20: '0xB1F80291d0EB60b75E7DF9422FB942d8FC575F4d',
      makerRegistry: '0xaBF694A434E0fE3b951409C01aa2db50Af4D2E3A',
    },
    [Network.POLYGON]: {
      swapERC20: '0xDECA72bDA0cDf62d79b46B1585B380c9C6d57D9E',
      makerRegistry: '0x9F11691FA842856E44586380b27Ac331ab7De93d',
    },
    [Network.ARBITRUM]: {
      swapERC20: '0x5E5A433cdfB14aB228c45E23251Ad83F7b1E3302',
      makerRegistry: '0xaBF694A434E0fE3b951409C01aa2db50Af4D2E3A',
    },
    [Network.AVALANCHE]: {
      swapERC20: '0x5E5A433cdfB14aB228c45E23251Ad83F7b1E3302',
      makerRegistry: '0xE40feb39fcb941A633deC965Abc9921b3FE962b2',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // @TODO - PARASWAP
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
