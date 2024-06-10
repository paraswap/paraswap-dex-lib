import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { DexParams } from './types';

// TODO: move all algebraV1 powered dexes to event based
export const QuickSwapConfig: DexConfigMap<DexParams> = {
  ThenaFusion: {
    [Network.BSC]: {
      factoryAddress: '0x306F06C147f064A010530292A1EB6737c3e378e4',
      router: '0x327Dd3208f0bCF590A66110aCB6e5e6941A4EfA0',
      quoteAddress: '0xeA68020D6A9532EeC42D4dB0f92B83580c39b2cA',
      initCode:
        '0xd61302e7691f3169f5ebeca3a0a4ab8f7f998c01e55ec944e62cfb1109fd2736',
    },
  },
};
