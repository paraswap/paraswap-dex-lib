import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const UsualMSmartMConfig: DexConfigMap<DexParams> = {
  UsualMSmartM: {
    [Network.MAINNET]: {
      smartMAddress: '0x437cc33344a0B27A429f795ff6B469C72698B291',
      usualMAddress: '0x0000000000000000000000000000000000000000', //TODO: replace with actual address
    },
  },
};
