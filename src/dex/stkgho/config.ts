import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

import { MiscEthereum } from '@bgd-labs/aave-address-book';

export const StkGHOConfig: DexConfigMap<DexParams> = {
  StkGHO: {
    [Network.MAINNET]: {
      stkGHO: '0x1a88Df1cFe15Af22B3c4c783D4e6F7F9e0C1885d',
      GHO: MiscEthereum.GHO_TOKEN,
    },
  },
};
