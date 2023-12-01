import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WombatConfig: DexConfigMap<DexParams> = {
  Wombat: {
    [Network.BSC]: {
      bmwAddress: '0x489833311676B566f888119c29bd997Dc6C95830',
    },
    [Network.ARBITRUM]: {
      bmwAddress: '0x62A83C6791A3d7950D823BB71a38e47252b6b6F4',
    },
    [Network.MAINNET]: {
      bmwAddress: '0xC9bFC3eFeFe4CF96877009F75a61F5c1937e5d1a',
    },
    [Network.AVALANCHE]: {
      bmwAddress: '0x6521a549834F5E6d253CD2e5F4fbe4048f86cd7b',
    },
    [Network.BASE]: {
      bmwAddress: '0x6521a549834F5E6d253CD2e5F4fbe4048f86cd7b',
    },
    // [Network.OPTIMISM]: {
    //   bmwAddress: '0x82E62f4e174E3C5e1641Df670c91Ac6Ab8541518',
    // },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: {
    [SwapSide.SELL]: [
      {
        name: 'BscAdapter02',
        index: 7,
      },
    ],
    // [SwapSide.BUY]: [
    //   {
    //     name: 'BscBuyAdapter',
    //     index: 1,
    //   },
    // ],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [
      {
        name: 'ArbitrumAdapter02',
        index: 8,
      },
    ],
    // [SwapSide.BUY]: [
    //   {
    //     name: 'ArbitrumBuyAdapter',
    //     index: 1,
    //   },
    // ],
  },
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter03',
        index: 15,
      },
    ],
    // [SwapSide.BUY]: [
    //   {
    //     name: 'BscBuyAdapter',
    //     index: 1,
    //   },
    // ],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter02',
        index: 7,
      },
    ],
    // [SwapSide.BUY]: [
    //   {
    //     name: 'BscBuyAdapter',
    //     index: 1,
    //   },
    // ],
  },
  [Network.BASE]: {
    [SwapSide.SELL]: [
      {
        name: 'BaseAdapter01',
        index: 7,
      },
    ],
    // [SwapSide.BUY]: [
    //   {
    //     name: 'BscBuyAdapter',
    //     index: 1,
    //   },
    // ],
  },
};
