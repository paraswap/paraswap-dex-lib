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
      chunksCount: 10,
      algebraStateMulticall: '0xfb948e6e23eb58ec7320ddb60df9115de07141ec',
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/sameepsi/quickswap-v3',
      uniswapMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      deployer: '0x2d98e2fa9da15aa6dc9581ab097ced7af697cb92',
    },
    [Network.ZKEVM]: {
      factory: '0x4B9f4d2435Ef65559567e5DbFC1BbB37abC43B57',
      router: '0xF6Ad3CcF71Abb3E12beCf6b3D2a74C963859ADCd',
      quoter: '0x55BeE1bD3Eb9986f6d2d963278de09eE92a3eF1D',
      initHash:
        '0x6ec6c9c8091d160c0aa74b2b14ba9c1717e95093bd3ac085cee99a49aab294a4',
      chunksCount: 10,
      algebraStateMulticall: '0x', // TODO
      subgraphURL:
        'https://api.studio.thegraph.com/query/44554/quickswap-v3-02/0.0.7',
      uniswapMulticall: '0x61530d6E1c7A47BBB3e48e8b8EdF7569DcFeE121',
      deployer: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // validate
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
