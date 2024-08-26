import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { MiscEthereum } from '@bgd-labs/aave-address-book';

export const StkGHOConfig: DexConfigMap<DexParams> = {
  StkGHO: {
    [Network.MAINNET]: {
      stkGHO: '0x1a88Df1cFe15Af22B3c4c783D4e6F7F9e0C1885d',
      GHO: MiscEthereum.GHO_TOKEN,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
