import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';
import { DexParams } from './types';

export const RubiconRfqConfig: DexConfigMap<DexParams> = {
  RubiconRfq: {
    [Network.ARBITRUM]: {
      rfqAddress: '0x7988F58d6708AD5FA7597e0d19Be59Ed75027555',
    },
    [Network.OPTIMISM]: {
      rfqAddress: '0x0218D22B2f134C5b3000DBcB768f71693238c856',
    },
    [Network.BASE]: {
      rfqAddress: '0x6B49A0bD2744ACbDB2a4A901A3D5655323BD567E',
    },
  },
};
