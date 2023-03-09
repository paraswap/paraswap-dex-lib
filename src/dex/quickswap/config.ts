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
      factoryAddress: '0xDaa69c0153414d890F86fA811b1E48466B7758d4',
      router: '0x4FFEF19c5520Dec8b69b2519Ed0e69E7D79F3233',
      quoteAddress: '0x7B2B64EfC15781B507C9a4172888F1cFE5175179',
      initCode:
        '0x6ec6c9c8091d160c0aa74b2b14ba9c1717e95093bd3ac085cee99a49aab294a4',
    },
  },
};
