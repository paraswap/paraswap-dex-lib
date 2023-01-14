import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AirSwapConfig: DexConfigMap<DexParams> = {
  AirSwap: {
    [Network.MAINNET]: {
      swapERC20: '0xb1B586AfA8a2AaB42826Fb2Ab9896CD0c686d0F4',
      makerRegistry: '0x8F9DA6d38939411340b19401E8c54Ea1f51B8f95',
      wrapper: '0x5E5A433cdfB14aB228c45E23251Ad83F7b1E3302',
      pool: '0xe2E7AE67E7ee6d4D90dfef945aB6dE6A14dB4c17',
      staking: '0x6d88B09805b90dad911E5C5A512eEDd984D6860B',
      ast: '0x27054b13b1b798b345b591a4d22e6562d47ea75a',
    },
    [Network.BSC]: {
      swapERC20: '0xB1F80291d0EB60b75E7DF9422FB942d8FC575F4d',
      makerRegistry: '0xaBF694A434E0fE3b951409C01aa2db50Af4D2E3A',
      wrapper: '0xf54721F5C14CD6624b0cFeCa1EF9FF41C6E9bB2B',
      pool: '0x16B57a5958271C479f64BC5F830DfC4f30ba2235',
      staking: '0xDECA72bDA0cDf62d79b46B1585B380c9C6d57D9E',
      ast: '0x1ac0d76f11875317f8a7d791db94cdd82bd02bd1',
    },
    [Network.POLYGON]: {
      swapERC20: '0xDECA72bDA0cDf62d79b46B1585B380c9C6d57D9E',
      makerRegistry: '0x9F11691FA842856E44586380b27Ac331ab7De93d',
      wrapper: '0xB1F80291d0EB60b75E7DF9422FB942d8FC575F4d',
      pool: '0xb1b586afa8a2aab42826fb2ab9896cd0c686d0f4',
      staking: '0x71070c5607358fc25E3B4aaf4FB0a580c190252a',
      ast: '0x04bEa9FCE76943E90520489cCAb84E84C0198E29',
    },
    [Network.ARBITRUM]: {
      swapERC20: '0x5E5A433cdfB14aB228c45E23251Ad83F7b1E3302',
      makerRegistry: '0xaBF694A434E0fE3b951409C01aa2db50Af4D2E3A',
      wrapper: '0xf54721F5C14CD6624b0cFeCa1EF9FF41C6E9bB2B',
      pool: '0xb1B586AfA8a2AaB42826Fb2Ab9896CD0c686d0F4',
      staking: '0x71070c5607358fc25E3B4aaf4FB0a580c190252a',
      ast: '0xa1135c2f2c7798d31459b5fdaef8613419be1008',
    },
    [Network.AVALANCHE]: {
      swapERC20: '0x5E5A433cdfB14aB228c45E23251Ad83F7b1E3302',
      makerRegistry: '0xE40feb39fcb941A633deC965Abc9921b3FE962b2',
      wrapper: '0x517d482F686f11b922EED764692f2b42663ce2fa',
      pool: '0xd3B6279cD6b21e92A6c53476E59a2C819018D6fE',
      staking: '0x71070c5607358fc25E3B4aaf4FB0a580c190252a',
      ast: '0x702d0f43edd46b77ea2d48570b02c328a20a94a1',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  // --> There is no adapters for airswap just makers
  // [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
  // [Network.MAINNET]: {
  //   [SwapSide.SELL]: [{ name: 'Adapter01', index: 6 }],
  //   [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 2 }],
  // },
  // [Network.POLYGON]: {
  //   [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 13 }],
  //   [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 2 }],
  // },
  // [Network.ARBITRUM]: {
  //   [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 3 }],
  //   [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 2 }],
  // },
  // [Network.OPTIMISM]: {
  //   [SwapSide.SELL]: [{ name: 'OptimismAdapter01', index: 3 }],
  //   [SwapSide.BUY]: [{ name: 'OptimismBuyAdapter', index: 2 }],
  // },
};
