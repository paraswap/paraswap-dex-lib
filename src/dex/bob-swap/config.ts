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
          address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          decimals: 6,
        },
      ],
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.POLYGON]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
