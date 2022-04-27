import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const IbAmmConfig: DexConfigMap<DexParams> = {
  IbAmm: {
    [Network.MAINNET]: {
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      MIM: '0x99d8a9c45b2eca8864373a26d1459e3dff1e17f3',
      IBAMM_ADDRESS: '0x0a0B06322825cb979678C722BA9932E0e4B5fd90',
      IB_TOKENS: [
        '0xFAFdF0C4c1CB09d430Bf88c75D88BB46DAe09967', // ibAUD
        '0x1CC481cE2BD2EC7Bf67d1Be64d4878b16078F309', // ibCHF
        '0x69681f8fde45345C3870BCD5eaf4A05a60E7D227', // ibGBP
        '0x5555f75e3d5278082200Fb451D1b6bA946D8e13b', // ibJPY
        '0x96E61422b6A9bA0e068B6c5ADd4fFaBC6a4aae27', // ibEUR
        '0x95dFDC8161832e4fF7816aC4B6367CE201538253', // ibKRW
      ],
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {};

export enum SYMBOL {
  DAI = 'DAI',
  IBAUD = 'IBAUD',
  IBCHF = 'IBCHF',
  IBEUR = 'IBEUR',
  IBGBP = 'IBGBP',
  IBJPY = 'IBJPY',
  IBKRW = 'IBKRW',
  MIM = 'MIM',
}
