import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WooFiConfig: DexConfigMap<DexParams> = {
  WooFi: {
    // TODO: complete me!
    [Network.BSC]: {
      wooPPAddress: '0xbf365Ce9cFcb2d5855521985E351bA3bcf77FD3F',
      woOracleAddress: '0x6b6fBEc7934b104e81b2046D24A990e03e17afDC',
      wooFeeManagerAddress: '0xaA6c60D638d34261B764fEDB551E50Ab02c34C90',
      quoteToken: {
        // USDT
        address: '0x55d398326f99059ff775485246999027b3197955',
        decimals: 18,
      },
      baseTokens: {
        WBNB: {
          address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
          decimals: 18,
        },
        BTCB: {
          address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
          decimals: 18,
        },
        ETH: {
          address: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
          decimals: 18,
        },
        WOO: {
          address: '0x4691937a7508860f876c9c0a2a617e7d9e945d4b',
          decimals: 18,
        },
      },
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
