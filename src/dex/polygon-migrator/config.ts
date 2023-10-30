import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { SwapSide } from '@paraswap/core';

export const PolygonMigratorConfig: DexConfigMap<DexParams> = {
  PolygonMigrator: {
    [Network.MAINNET]: {
      migratorAddress: '0x29e7df7b6a1b2b07b731457f499e1696c60e2c4e',
      polTokenAddress: '0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6',
      maticTokenAddress: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[];
  };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter04', index: 4 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 11 }],
  },
};
