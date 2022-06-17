import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const SwaapV1Config: DexConfigMap<DexParams> = {
  SwaapV1: {
    [Network.POLYGON]: {
      subgraphURL: 'https://api.thegraph.com/subgraphs/name/swaap-labs/swaapv1',
      exchangeProxy: '0x718cc95685a0b0af73c2c8534243039a28687037'
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
        name: 'PolygonAdapter01',
        index: 1,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'PolygonAdapter01',
        index: 1,
      },
    ],
  },
};
