import { AdapterMappings, DexConfigMap } from '../../types';
import { DivaParams } from './types';
import { Network, SwapSide } from '../../constants';

export const DivaConfig: DexConfigMap<DivaParams> = {
  Diva: {
    [Network.MAINNET]: {  // currently only on sepolia
      divETH: '0x78Cb3BE3ee9C7aD14967aD10F9D2baFA79F2DC94',
      wdivETH: '0x3F806A22dc942934c66DeF5FF8eC45a89A5aF454',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter02', index: 6 }],
    [SwapSide.BUY]: [{ name: 'AvalancheBuyAdapter', index: 8 }],
  },
};
