import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const BobSwapConfig: DexConfigMap<DexParams> = {
  BobSwap: {
    [Network.POLYGON]: {
      bobSwapAddress: '0x25E6505297b44f4817538fB2d91b88e1cF841B54',
      bobTokenAddress: '0xB0B195aEFA3650A6908f15CdaC7D92F8a5791B0B',
      tokens: [
        // USDC
        {
          address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          decimals: 6,
        },
        // USDT
        {
          address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
          decimals: 6,
        },
      ],
    },
    [Network.MAINNET]: {
      bobSwapAddress: '0x15729Ac1795Fa02448a55D206005dC1914144a9F',
      bobTokenAddress: '0xB0B195aEFA3650A6908f15CdaC7D92F8a5791B0B',
      tokens: [
        // USDC
        {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          decimals: 6,
        },
        // USDT
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          decimals: 6,
        },
        // DAI
        {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          decimals: 18,
        },
      ],
    },
    [Network.OPTIMISM]: {
      bobSwapAddress: '0x8aEb89D5C689C2cf373Fe8b56c7A0cD5BDc74CE6',
      bobTokenAddress: '0xB0B195aEFA3650A6908f15CdaC7D92F8a5791B0B',
      tokens: [
        // USDC
        {
          address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
          decimals: 6,
        },
        // USDT
        {
          address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
          decimals: 6,
        },
      ],
    },
    [Network.BSC]: {
      bobSwapAddress: '0x61a57F1C82DA40e632C075D7812Af375Db23367c',
      bobTokenAddress: '0xB0B195aEFA3650A6908f15CdaC7D92F8a5791B0B',
      tokens: [
        // USDC
        {
          address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
          decimals: 18,
        },
        // USDT
        {
          address: '0x55d398326f99059fF775485246999027B3197955',
          decimals: 18,
        },
      ],
    },
    [Network.ARBITRUM]: {
      bobSwapAddress: '0x72e6B59D4a90ab232e55D4BB7ed2dD17494D62fB',
      bobTokenAddress: '0xB0B195aEFA3650A6908f15CdaC7D92F8a5791B0B',
      tokens: [
        // USDC
        {
          address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
          decimals: 6,
        },
        // USDT
        {
          address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          decimals: 6,
        },
      ],
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // This is an example to copy
  [Network.POLYGON]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
  [Network.OPTIMISM]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
  [Network.ARBITRUM]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
  [Network.BSC]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
