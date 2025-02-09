import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const EkuboConfig: DexConfigMap<DexParams> = {
  Ekubo: {
    [Network.MAINNET]: {
      apiUrl: 'https://eth-mainnet-api.ekubo.org',
      core: '0x39d8ab62fcaa5b466eb8397187732b6ba455aaa8',
      oracle: '0x51ee1902db6d5640163506b9e178a21ff027282c',
      dataFetcher: '0x6600246980f5c703796cc535383ea13b992e4311',
      swapper: '0x250E270236FA96Cf4831Eb312CDbbDbF8030dbB6',
    },
  },
};
