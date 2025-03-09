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
      core: '0xb98c50b291a8b69cffabd172de4d1bbc773f962a',
      oracle: '0x519c98252304a4933cdef1e66f139dfb0e2d2462',
      dataFetcher: '0x3b2b03c96f55c1a09a65d9c7e0b0abfe1816b02c',
      router: '0x82d25d06a00f04bae3a19107a8131afc019f3adf',
    },
  },
};
