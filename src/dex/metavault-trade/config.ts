import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MetavaultTradeConfig: DexConfigMap<DexParams> = {
  MetavaultTrade: {
    [Network.POLYGON]: {
      vault: '0x32848e2d3aecfa7364595609fb050a301050a6b4',
      reader: '0x01dd8b434a83cbddfa24f2ef1fe2d6920ca03734',
      priceFeed: '0xb022b0353fe4c4af6fb3f5b1243a8dA8a12E7c42',
      fastPriceFeed: '0x44ea6da1cd01899b0f4f17a09cd89eda49eb2b0a',
      fastPriceEvents: '0xac68262df02052f7a22a4251f13447c5e2f35db6',
      usdm: '0x533403a3346ca31d67c380917ffaf185c24e7333',
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[] | null;
  };
} = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'NEW_ADAPTER_HERE', // TODO: New adaptor which contains MetavaultTrade's Swap Route should come here...
        index: 1,
      },
    ],
  },
};
