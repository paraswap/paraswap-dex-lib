import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AaveGsmConfig: DexConfigMap<DexParams> = {
  AaveGsm: {
    [Network.MAINNET]: {
      gho: {
        address: '0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f',
        decimals: 18,
      },
      pools: [
        {
          underlying: {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
          },
          gsmAddress: '0x0d8effc11df3f229aa1ea0509bc9dfa632a13578',
          identifier:
            '0x47534d2d55534443000000000000000000000000000000000000000000000000', // bytes32("GSM-USDC")
        },
        {
          underlying: {
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            decimals: 6,
          },
          gsmAddress: '0x686f8d21520f4ecec7ba577be08354f4d1eb8262',
          identifier:
            '0x47534d2d55534454000000000000000000000000000000000000000000000000', // bytes32("GSM-USDT")
        },
      ],
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
