import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const HodltreeFlashloanExchangeConfig: DexConfigMap<DexParams> = {
  HodltreeFlashloanExchange: {
    [Network.ROPSTEN]: {
      pools: ['0xC9D7709D6f7d230399443D3DF5D60E268B212697'],
      exchange: '0xD31E7D0Bfd56C41D1C9DA578810C50E76A79bd11',
    },
    [Network.POLYGON]: {
      pools: ['0x2d6cfcc01c7233552f76de3c243b4548f0965a37'],
      exchange: '0x9690634553dd8a88dd45b563584eb35e646acdfd',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  // TODO: add adapters for each chain
};
