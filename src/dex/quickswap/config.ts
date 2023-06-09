import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { DexParams } from './types';

export const QuickSwapConfig: DexConfigMap<DexParams> = {
  ZyberSwapV3: {
    [Network.ARBITRUM]: {
      factoryAddress: '0x9C2ABD632771b433E5E7507BcaA41cA3b25D8544',
      router: '0xFa58b8024B49836772180f2Df902f231ba712F72',
      quoteAddress: '0xAeD211346Fa2E6A5063b4f273BCf7DDbD0368d62',
      initCode:
        '0x6ec6c9c8091d160c0aa74b2b14ba9c1717e95093bd3ac085cee99a49aab294a4',
    },
  },
  ThenaFusion: {
    [Network.BSC]: {
      factoryAddress: '0x306F06C147f064A010530292A1EB6737c3e378e4',
      router: '0x327Dd3208f0bCF590A66110aCB6e5e6941A4EfA0',
      quoteAddress: '0xeA68020D6A9532EeC42D4dB0f92B83580c39b2cA',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    },
  },
  QuickSwapV3: {
    [Network.POLYGON]: {
      factoryAddress: '0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28',
      router: '0xf5b509bb0909a69b1c207e495f687a596c168e12',
      quoteAddress: '0xa15f0d7377b2a0c0c10db057f641bed21028fc89',
      initCode:
        '0xfa2ad44b9e39d38a7d396bb44a41ea957ac7b622c5c6afdc285728c300b3382a',
    },
  },
  SpiritSwapV3: {
    [Network.FANTOM]: {
      factoryAddress: '0xC58A98644fCeee73bc2B6d349B3102627e2Ec58e',
      router: '0x03108EDEd4902e89781839c885496c6de9D21956',
      quoteAddress: '0xc4D1310D60A36c7d849A332Be8Dcff29603fe907',
      initCode:
        '0xa360004fb86ddf4cd7fe9aa67d0c6a7f7812d9069142659003dc503e1d7d241f',
    },
  },
};
