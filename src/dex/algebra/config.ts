import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const AlgebraConfig: DexConfigMap<DexParams> = {
  QuickSwapV3: {
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
  [Network.ZKEVM]: {
    [SwapSide.SELL]: [{ name: 'PolygonZkEvmAdapter01', index: 1 }],
    [SwapSide.BUY]: [{ name: 'PolygonZkEvmBuyAdapter', index: 1 }],
  },
};
