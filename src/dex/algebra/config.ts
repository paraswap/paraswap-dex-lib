import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AlgebraConfig: DexConfigMap<DexParams> = {
  QuickSwapV3: {
    [Network.POLYGON]: {
      factory: '0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28',
      router: '0xf5b509bb0909a69b1c207e495f687a596c168e12',
      quoter: '0xa15f0d7377b2a0c0c10db057f641bed21028fc89',
      initHash:
        '0x6ec6c9c8091d160c0aa74b2b14ba9c1717e95093bd3ac085cee99a49aab294a4',
    },
    [Network.ZKEVM]: {
      factory: '0x4B9f4d2435Ef65559567e5DbFC1BbB37abC43B57',
      router: '0xF6Ad3CcF71Abb3E12beCf6b3D2a74C963859ADCd',
      quoter: '0x55BeE1bD3Eb9986f6d2d963278de09eE92a3eF1D',
      initHash:
        '0x6ec6c9c8091d160c0aa74b2b14ba9c1717e95093bd3ac085cee99a49aab294a4',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 13 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 2 }],
  },
  [Network.ZKEVM]: {
    [SwapSide.SELL]: [{ name: 'PolygonZkEvmAdapter01', index: 1 }],
    [SwapSide.BUY]: [{ name: 'PolygonZkEvmBuyAdapter', index: 1 }],
  },
};
