import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MetavaultTradeConfig: DexConfigMap<DexParams> = {
  MetavaultTrade: {
    [Network.POLYGON]: {
      vault: '0x32848E2d3aeCFA7364595609FB050A301050A6B4',
      reader: '0x01dd8B434A83cbdDFa24f2ef1fe2D6920ca03734',
      priceFeed: '0x133f4D5e703d68eEf3Ea22037C410F042C1642b2',
      fastPriceFeed: '0xf21bd514bAcBAd2559e41b1819838eE0Dd6ac8F0',
      fastPriceEvents: '0xac68262DF02052F7A22a4251F13447C5e2f35db6',
      usdm: '0x533403a3346cA31D67c380917ffaF185c24e7333',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'NEW_ADAPTER_COME_HERE', index: 13 }],
  },
};
