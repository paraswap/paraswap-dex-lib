import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AngleTransmuterConfig: DexConfigMap<DexParams> = {
  AngleTransmuter: {
    [Network.MAINNET]: {
      EUR: {
        stablecoin: {
          address: '0x1a7e4e63778B4f12a199C062f3eFdD288afCBce8',
          decimals: 18,
        },
        transmuter: '0x00253582b2a3FE112feEC532221d9708c64cEFAb',
        pyth: '0x4305FB66699C3B2702D4d05CF36551390A4c69C6',
      },
      USD: {
        stablecoin: {
          address: '0x0000206329b97DB379d5E1Bf586BbDB969C63274',
          decimals: 18,
        },
        transmuter: '0x222222fD79264BBE280b4986F6FEfBC3524d0137',
        pyth: '0x4305FB66699C3B2702D4d05CF36551390A4c69C6',
      },
    },
    [Network.ARBITRUM]: {
      USD: {
        stablecoin: {
          address: '0x0000206329b97DB379d5E1Bf586BbDB969C63274',
          decimals: 18,
        },
        transmuter: '0xD253b62108d1831aEd298Fc2434A5A8e4E418053',
        pyth: '0xff1a0f4744e8582DF1aE09D5611b887B6a12925C',
      },
    },
    [Network.BASE]: {
      USD: {
        stablecoin: {
          address: '0x0000206329b97DB379d5E1Bf586BbDB969C63274',
          decimals: 18,
        },
        transmuter: '0x222222880e079445Df703c0604706E71a538Fd4f',
        pyth: '0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a',
      },
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
