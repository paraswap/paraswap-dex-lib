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
        {
          address: '0x39dE4e02F76Dbd4352Ec2c926D8d64Db8aBdf5b2',
          name: 'Alt Pool BTC',
        },
        //{
        //  address: '0x4658EA7e9960D6158a261104aAA160cC953bb6ba',
        //  name: 'Alt Pool sAVAX',
        //},
        //{
        //  address: '0xC828D995C686AaBA78A4aC89dfc8eC0Ff4C5be83',
        //  name: 'Alt Pool YUSD',
        //},
        //{
        //  address: '0x233Ba46B01d2FbF1A31bDBc500702E286d6de218',
        //  name: 'Factory Pool H2O',
        //},
        //{
        //  address: '0x27912AE6Ba9a54219d8287C3540A8969FF35500B',
        //  name: 'Factory Pool MONEY',
        //},
        //{
        //  address: '0x91BB10D68C72d64a7cE10482b453153eEa03322C',
        //  name: 'Factory Pool TSD',
        //},
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
