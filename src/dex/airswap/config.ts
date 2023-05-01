import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AirSwapConfig: DexConfigMap<DexParams> = {
  AirSwap: {
    [Network.MAINNET]: {
      swapErc20: '0xd82FA167727a4dc6D6F55830A2c47aBbB4b3a0F8',
      makerRegistry: '0x8F9DA6d38939411340b19401E8c54Ea1f51B8f95',
    },
    [Network.BSC]: {
      swapErc20: '0xd82FA167727a4dc6D6F55830A2c47aBbB4b3a0F8',
      makerRegistry: '0x9F11691FA842856E44586380b27Ac331ab7De93d',
    },
    [Network.POLYGON]: {
      swapErc20: '0xd82FA167727a4dc6D6F55830A2c47aBbB4b3a0F8',
      makerRegistry: '0x9F11691FA842856E44586380b27Ac331ab7De93d',
    },
    [Network.ARBITRUM]: {
      swapErc20: '0xd82FA167727a4dc6D6F55830A2c47aBbB4b3a0F8',
      makerRegistry: '0xaBF694A434E0fE3b951409C01aa2db50Af4D2E3A',
    },
    [Network.AVALANCHE]: {
      swapErc20: '0xd82FA167727a4dc6D6F55830A2c47aBbB4b3a0F8',
      makerRegistry: '0xE40feb39fcb941A633deC965Abc9921b3FE962b2',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // @TODO - PARASWAP
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
