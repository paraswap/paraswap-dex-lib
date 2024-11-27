import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const UsualMUsd0Config: DexConfigMap<DexParams> = {
  UsualMUsd0: {
    [Network.MAINNET]: {
      usualMAddress: '0xFe274C305b365dC38e188E8f01c4FAe2171ce927',
      usd0Address: '0x73A15FeD60Bf67631dC6cd7Bc5B6e8da8190aCF5',
      usualDaoCollateralAddress: '0xde6e1F680C4816446C8D515989E2358636A38b04',
    },
  },
};
