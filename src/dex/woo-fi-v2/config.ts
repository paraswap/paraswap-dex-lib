import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WooFiV2Config: DexConfigMap<DexParams> = {
  WooFiV2: {
    [Network.POLYGON]: {
      wooPPV2Address: '0x8693F9701D6DB361Fe9CC15Bc455Ef4366E39AE0',
      wooOracleAddress: '0x962d37fb9d75fe1af9aab323727183e4eae1322d',
      quoteToken: {
        // USDC
        address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        decimals: 6,
      },
      baseTokens: {
        WBTC: {
          address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
          decimals: 8,
        },
        WETH: {
          address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
          decimals: 18,
        },
        WOO: {
          address: '0xcAFcD85D8ca7Ad1e1C6F82F651fA15E33AEfD07b',
          decimals: 18,
        },
      },
      rebateTo: '0x0c84cd406b8a4e07df9a1b15ef348023a1dcd075',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 0 }], // TODO: what index should be?
  },
};
