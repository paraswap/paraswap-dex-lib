import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { DexParams } from './types';

// TODO: move all algebraV1 powered dexes to event based
export const QuickSwapConfig: DexConfigMap<DexParams> = {
  CamelotV3: {
    [Network.ARBITRUM]: {
      factoryAddress: '0x1a3c9B1d2F0529D97f2afC5136Cc23e58f1FD35B',
      router: '0x1F721E2E82F6676FCE4eA07A5958cF098D339e18',
      quoteAddress: '0x0Fc73040b26E9bC8514fA028D998E73A254Fa76E',
      initCode:
        '0x6c1bebd370ba84753516bc1393c0d0a6c645856da55f5393ac8ab3d6dbc861d3',
    },
  },
  ThenaFusion: {
    [Network.BSC]: {
      factoryAddress: '0x306F06C147f064A010530292A1EB6737c3e378e4',
      router: '0x327Dd3208f0bCF590A66110aCB6e5e6941A4EfA0',
      quoteAddress: '0xeA68020D6A9532EeC42D4dB0f92B83580c39b2cA',
      initCode:
        '0xd61302e7691f3169f5ebeca3a0a4ab8f7f998c01e55ec944e62cfb1109fd2736',
    },
  },
  SpiritSwapV3: {
    [Network.FANTOM]: {
      factoryAddress: '0x7c1864d96A1AeD6F171BE1880CA9c2c51846E502',
      router: '0x940438cEd3062E3F7aE311c789FA9dDd3a5eA951',
      quoteAddress: '0x2E0e6a11609003Ca596F143d40e6b62eE92c501A',
      initCode:
        '0xbce37a54eab2fcd71913a0d40723e04238970e7fc1159bfd58ad5b79531697e7',
    },
  },
};
