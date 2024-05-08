import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AngleStakedStableConfig: DexConfigMap<DexParams> = {
  // USDA <-> stUSD
  AngleStakedStableUSD: {
    [Network.ARBITRUM]: {
      agToken: '0x0000206329b97db379d5e1bf586bbdb969c63274',
      stakeToken: '0x0022228a2cc5e7ef0274a7baa600d44da5ab5776',
    },
    [Network.MAINNET]: {
      agToken: '0x0000206329b97db379d5e1bf586bbdb969c63274',
      stakeToken: '0x0022228a2cc5e7ef0274a7baa600d44da5ab5776',
    },
    [Network.OPTIMISM]: {
      agToken: '0x0000206329b97db379d5e1bf586bbdb969c63274',
      stakeToken: '0x0022228a2cc5e7ef0274a7baa600d44da5ab5776',
    },
    [Network.POLYGON]: {
      agToken: '0x0000206329b97db379d5e1bf586bbdb969c63274',
      stakeToken: '0x0022228a2cc5e7ef0274a7baa600d44da5ab5776',
    },
    [Network.BASE]: {
      agToken: '0x0000206329b97db379d5e1bf586bbdb969c63274',
      stakeToken: '0x0022228a2cc5e7ef0274a7baa600d44da5ab5776',
    },
    [Network.BSC]: {
      agToken: '0x0000206329b97db379d5e1bf586bbdb969c63274',
      stakeToken: '0x0022228a2cc5e7ef0274a7baa600d44da5ab5776',
    },
  },
  // EURA <-> stEUR
  AngleStakedStableEUR: {
    [Network.ARBITRUM]: {
      agToken: '0xfa5ed56a203466cbbc2430a43c66b9d8723528e7',
      stakeToken: '0x004626a008b1acdc4c74ab51644093b155e59a23',
    },
    [Network.MAINNET]: {
      agToken: '0x1a7e4e63778b4f12a199c062f3efdd288afcbce8',
      stakeToken: '0x004626a008b1acdc4c74ab51644093b155e59a23',
    },
    [Network.OPTIMISM]: {
      agToken: '0x9485aca5bbbe1667ad97c7fe7c4531a624c8b1ed',
      stakeToken: '0x004626a008b1acdc4c74ab51644093b155e59a23',
    },
    [Network.POLYGON]: {
      agToken: '0xe0b52e49357fd4daf2c15e02058dce6bc0057db4',
      stakeToken: '0x004626a008b1acdc4c74ab51644093b155e59a23',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [
      {
        name: 'ArbitrumAdapter03',
        index: 1,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'ArbitrumBuyAdapter',
        index: 10,
      },
    ],
  },
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter06',
        index: 1,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BuyAdapter02',
        index: 4,
      },
    ],
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [
      {
        name: 'OptimismAdapter02',
        index: 1,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'OptimismBuyAdapter',
        index: 6,
      },
    ],
  },
  [Network.BASE]: {
    [SwapSide.SELL]: [
      {
        name: 'BaseAdapter01',
        index: 11,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BaseBuyAdapter',
        index: 7,
      },
    ],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter02',
        index: 10,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'PolygonBuyAdapter',
        index: 9,
      },
    ],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [
      {
        name: 'BscAdapter02',
        index: 10,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BscBuyAdapter',
        index: 8,
      },
    ],
  },
};
