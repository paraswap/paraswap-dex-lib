import { SwapSide } from 'paraswap-core';
import { Network } from '../../../../constants';
import { AdapterMappings, DexConfigMap } from '../../../../types';
import { DexParams } from '../../types';

export const SwerveConfig: DexConfigMap<DexParams> = {
  Swerve: {
    [Network.MAINNET]: {
      baseTokens: {},
      factoryAddress: null,
      eventSupportedPools: ['0x329239599afb305da0a2ec69c58f8a6697f9f88d'],
      pools: {
        Swerve: {
          underlying: [],
          coins: [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            '0xdac17f958d2ee523a2206206994597c13d831ec7',
            '0x0000000000085d4780B73119b644AE5ecd22b376',
          ],
          address: '0x329239599afb305da0a2ec69c58f8a6697f9f88d',
          name: 'Swerve',
          type: 1,
          version: 2,
          isLending: false,
          isMetapool: false,
        },
      },
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter01',
        index: 3,
      },
    ],
  },
};
