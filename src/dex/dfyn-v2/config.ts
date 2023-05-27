import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Address } from '../../types';

const SUPPORTED_FEES = [1500n];

// Pools that will be initialized on app startup
// They are added for testing
export const PoolsToPreload: DexConfigMap<
  { token0: Address; token1: Address }[]
> = {
  DfynV2: {
    [Network.POLYGON]: [
      {
        token0: '0x16ECCfDbb4eE1A85A33f3A9B21175Cd7Ae753dB4'.toLowerCase(),
        token1: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(),
      },
      {
        token0: '0xC168E40227E4ebD8C1caE80F7a55a4F0e6D66C97'.toLowerCase(),
        token1: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase(),
      },
    ],
  },
};

export const DfynV2Config: DexConfigMap<DexParams> = {
  DfynV2: {
    [Network.POLYGON]: {
      factory: '0xf79a83E3f8E853D9658e8b97a83942Af80d45b85',
      quoter: '0xeE4545ABC69C17Bbc48971E4be98D35626Bd8793',
      router: '0x65AC726680E958Ae6872569C08c264Fe04D65C80',
      supportedFees: SUPPORTED_FEES,
      poolHelper: '0x02dE9a2031ac7E53e5170236C8857659aB915db8',
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
