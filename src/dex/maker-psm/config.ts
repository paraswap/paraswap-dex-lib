import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

// Warning: Addresses should be lowercased
export const MakerPsmConfig: DexConfigMap<DexParams> = {
  MakerPsm: {
    [Network.MAINNET]: {
      dai: {
        address: '0x6b175474e89094c44da98b954eedeac495271d0f',
        decimals: 18,
      },
      vatAddress: '0x35d1b3f3d7966a1dfe207aa4514c12a259a0492b',
      pools: [
        {
          gem: {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
          },
          gemJoinAddress: '0x0a59649758aa4d66e25f08dd01271e891fe52199',
          psmAddress: '0x89b78cfa322f6c5de0abceecab66aee45393cc5a',
          identifier:
            '0x50534d2d555344432d4100000000000000000000000000000000000000000000', // bytes32("PSM-USDC-A")
        },
        {
          gem: {
            address: '0x8e870d67f660d95d5be530380d0ec0bd388289e1',
            decimals: 18,
          },
          gemJoinAddress: '0x7bbd8ca5e413bca521c2c80d8d1908616894cf21',
          psmAddress: '0x961ae24a1ceba861d1fdf723794f6024dc5485cf',
          identifier:
            '0x50534d2d5041582d410000000000000000000000000000000000000000000000', // bytes32("PSM-PAX-A")
        },
      ],
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter03',
        index: 9,
      },
    ],
  },
};
