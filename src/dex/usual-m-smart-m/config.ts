import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const UsualMSmartMConfig: DexConfigMap<DexParams> = {
  UsualMSmartM: {
    [Network.MAINNET]: {
      smartMAddress: '0x437cc33344a0B27A429f795ff6B469C72698B291',
      usualMAddress: '0xFe274C305b365dC38e188E8f01c4FAe2171ce927',
    },
  },
};
