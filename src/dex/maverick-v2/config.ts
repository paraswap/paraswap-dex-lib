import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const MAV_V2_BASE_GAS_COST = 50_000;
export const MAV_V2_TICK_GAS_COST = 10_000;

export const MaverickV2Config: DexConfigMap<DexParams> = {
  MaverickV2: {
    [Network.BASE]: {
      quoterAddress: `0xb40AfdB85a07f37aE217E7D6462e609900dD8D7A`,
      poolLensAddress: `0x942646b0A8B42Af1e1044439013436a9a3e080b5`,
      apiURL: 'https://v2-api.mav.xyz/',
    },
    [Network.MAINNET]: {
      quoterAddress: `0xb40AfdB85a07f37aE217E7D6462e609900dD8D7A`,
      poolLensAddress: `0x942646b0A8B42Af1e1044439013436a9a3e080b5`,
      apiURL: 'https://v2-api.mav.xyz/',
    },
    [Network.BSC]: {
      quoterAddress: `0xb40AfdB85a07f37aE217E7D6462e609900dD8D7A`,
      poolLensAddress: `0x942646b0A8B42Af1e1044439013436a9a3e080b5`,
      apiURL: 'https://v2-api.mav.xyz/',
    },
    [Network.ARBITRUM]: {
      quoterAddress: `0xb40AfdB85a07f37aE217E7D6462e609900dD8D7A`,
      poolLensAddress: `0x942646b0A8B42Af1e1044439013436a9a3e080b5`,
      apiURL: 'https://v2-api.mav.xyz/',
    },
  },
};
