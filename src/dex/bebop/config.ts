import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const BebopConfig: DexConfigMap<DexParams> = {
  // TODO: sync the middle tokens
  Bebop: {
    [Network.MAINNET]: {
      settlementAddress: '0xbbbbbBB520d69a9775E85b458C58c648259FAD5F',
      chainName: 'ethereum',
      middleTokens: [
        // TODO: expand middle tokens
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ],
    },
    [Network.ARBITRUM]: {
      settlementAddress: '0xbbbbbBB520d69a9775E85b458C58c648259FAD5F',
      chainName: 'arbitrum',
      middleTokens: [
        '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      ],
    },
    [Network.BASE]: {
      settlementAddress: '0xbbbbbBB520d69a9775E85b458C58c648259FAD5F',
      chainName: 'base',
      middleTokens: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'],
    },
    [Network.OPTIMISM]: {
      settlementAddress: '0xbbbbbBB520d69a9775E85b458C58c648259FAD5F',
      chainName: 'optimism',
      middleTokens: ['0x7F5c764cBc14f9669B88837ca1490cCa17c31607'],
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter03', index: 14 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 7 }],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter02', index: 2 }],
    [SwapSide.BUY]: [{ name: 'BscBuyAdapter', index: 3 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 14 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter', index: 4 }],
  },
  [Network.BASE]: {
    [SwapSide.SELL]: [{ name: 'BaseAdapeter01', index: 11 }],
    [SwapSide.BUY]: [{ name: 'BaseBuyAdapter', index: 7 }],
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [{ name: 'OptimismAdapter01', index: 10 }],
    [SwapSide.BUY]: [{ name: 'OptimismBuyAdapter', index: 4 }],
  },
};
