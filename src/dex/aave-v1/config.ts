import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AaveV1Config: DexConfigMap<DexParams> = {
  AaveV1: {
    [Network.MAINNET]: {},
  },
};

export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter03',
        index: 5,
      },
    ],
  },
};
