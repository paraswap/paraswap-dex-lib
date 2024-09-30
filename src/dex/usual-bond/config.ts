import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const UsualBondConfig: DexConfigMap<DexParams> = {
  UsualBond: {
    [Network.MAINNET]: {
      usd0Address: '0x73A15FeD60Bf67631dC6cd7Bc5B6e8da8190aCF5',
      usd0ppAddress: '0x35D8949372D46B7a3D5A56006AE77B215fc69bC0',
    },
  },
};
