import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MetavaultTradeConfig: DexConfigMap<DexParams> = {
  MetavaultTrade: {
    [Network.POLYGON]: {
      vault: '0x32848E2d3aeCFA7364595609FB050A301050A6B4',
      priceFeed: '0xb022b0353fe4c4af6fb3f5b1243a8dA8a12E7c42',
      fastPriceFeed: '0x44Ea6DA1cD01899B0f4f17a09cD89EdA49EB2B0a',
      fastPriceEvents: '0xac68262DF02052F7A22a4251F13447C5e2f35db6',
      usdm: '0x533403a3346cA31D67c380917ffaF185c24e7333',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 1 }],
  },
};
