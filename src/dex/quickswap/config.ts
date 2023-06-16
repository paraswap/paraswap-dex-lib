import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { DexParams } from './types';

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
  ZyberSwapV3: {
    [Network.ARBITRUM]: {
      factoryAddress: '0x9C2ABD632771b433E5E7507BcaA41cA3b25D8544',
      router: '0xFa58b8024B49836772180f2Df902f231ba712F72',
      quoteAddress: '0xAeD211346Fa2E6A5063b4f273BCf7DDbD0368d62',
      initCode:
        '0x6ec6c9c8091d160c0aa74b2b14ba9c1717e95093bd3ac085cee99a49aab294a4',
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
