import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const MiroMigratorConfig: DexConfigMap<DexParams> = {
  MiroMigrator: {
    [Network.OPTIMISM]: {
      migratorAddress: '0x5032433fB65D7db8e8B90Cb239d50fDFD941fb6b',
      pspTokenAddress: '0x326Aec8d7d99d1D6022c57C5f6194D2a7867227d',
      xyzTokenAddress: '0xa2781111F824Ca1Cd98454B2C9722BAefC898e99',
    },
  },
};
