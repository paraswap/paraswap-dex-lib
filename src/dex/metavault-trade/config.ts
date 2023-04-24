import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MetavaultTradeConfig: DexConfigMap<DexParams> = {
  MetavaultTrade: {
    [Network.POLYGON]: {
      vault: '0x32848e2d3aecfa7364595609fb050a301050a6b4',
      reader: '0x01dd8b434a83cbddfa24f2ef1fe2d6920ca03734',
      priceFeed: '0x133f4D5e703d68eEf3Ea22037C410F042C1642b2',
      fastPriceFeed: '0xf99e34f3b79c1f185a9f0963acc21128ba2239f8',
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
        name: 'PolygonAdapter01', // TODO: New adaptor which contains MetavaultTrade's Swap Route should come here...
        index: 1,
      },
    ],
  },
};
