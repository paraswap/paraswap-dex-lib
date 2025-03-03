import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const EkuboConfig: DexConfigMap<DexParams> = {
  Ekubo: {
    /*[Network.MAINNET]: {
      apiUrl: 'https://eth-mainnet-api.ekubo.org',
      core: '0x0',
      oracle: '0x0',
      dataFetcher: '0x0',
      router: '0x0',
    },*/
    [Network.SEPOLIA]: {
      apiUrl: 'https://eth-sepolia-api.ekubo.org',
      core: '0x16e186ecdc94083fff53ef2a41d46b92a54f61e2',
      oracle: '0x51f1b10abf90e16498d25086641b0669ec62f32f',
      dataFetcher: '0xe339a5e10f48d5c34255fd417f329d2026634b32',
      router: '0xab090b2d86a32ab9ed214224f59dc7453be1037e',
    },
  },
};
