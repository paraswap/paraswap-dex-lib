import { Network, SwapSide } from '../../constants';
import { DexConfigMap } from '../../types';

type DexParams = {
  swETH: string;
};

export const SwellConfig: DexConfigMap<DexParams> = {
  Swell: {
    [Network.MAINNET]: {
      swETH: '0xf951E335afb289353dc249e82926178EaC7DEd78',
    },
  },
};

export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter05',
        index: 1,
      },
    ],
  },
};
