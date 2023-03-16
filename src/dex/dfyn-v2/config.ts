import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Address } from '../../types';

const SUPPORTED_FEES = [500n];

// Pools that will be initialized on app startup
// They are added for testing
export const PoolsToPreload: DexConfigMap<
  { token0: Address; token1: Address }[]
> = {
  DfynV2: {
    [Network.POLYGON]: [
      {
        token0: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'.toLowerCase(),
        token1: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(),
      },
      {
        token0: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'.toLowerCase(),
        token1: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(),
      },
    ],
  },
};

export const DfynV2Config: DexConfigMap<DexParams> = {
  DfynV2: {
    [Network.POLYGON]: {
      factory: '0x20F200c65bDD173Df64a528e28F77F06ebDE61D9',
      quoter: '0xF256047C239788304e350Bf2b5Dd14129b87720A',
      router: '0x5e3F49d3010FAc405Ce7f3fD0bd1Ea7e4cfa28E6',
      supportedFees: SUPPORTED_FEES,
      stateMulticall: '0x6Dc993Fe1e945A640576B4Dca81281d8e998DF71',
      dfynMulticall: '0x1F98415757620B543A52E61c46B32eB19261F984',
      chunksCount: 10,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 13 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 2 }],
  },
};
