import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const ConcentratorArusdConfig: DexConfigMap<DexParams> = {
  ConcentratorArusd: {
    [Network.MAINNET]: {
      rUSDAddress: '0x65D72AA8DA931F047169112fcf34f52DbaAE7D18',
      arUSDAddress: '0x07D1718fF05a8C53C8F05aDAEd57C0d672945f9a',
      weETHAddress: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: 'Adapter02', index: 0 }] },
};
