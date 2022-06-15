import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const PlatypusConfig: DexConfigMap<DexParams> = {
  Platypus: {
    [Network.AVALANCHE]: {
      pools: [
        {
          address: '0x66357dCaCe80431aee0A7507e2E361B7e2402370',
          name: 'Main USD Pool',
        },
        {
          address: '0xB8E567fc23c39C94a1f6359509D7b43D1Fbed824',
          name: 'Alt Pool Frax',
        },
        {
          address: '0x30C30d826be87Cd0A4b90855C2F38f7FcfE4eaA7',
          name: 'Alt Pool MIM',
        },
      ],
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 10,
      },
    ],
  },
};
