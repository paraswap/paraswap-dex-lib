import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WooFiConfig: DexConfigMap<DexParams> = {
  WooFi: {
    [Network.BSC]: {
      wooPPAddress: '0xbf365Ce9cFcb2d5855521985E351bA3bcf77FD3F',
      wooOracleAddress: '0x6b6fBEc7934b104e81b2046D24A990e03e17afDC',
      wooFeeManagerAddress: '0xaA6c60D638d34261B764fEDB551E50Ab02c34C90',
      wooGuardianAddress: '0x910723e3c6a68276687b50613a1a9e42cc6589b4',
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
    [Network.AVALANCHE]: {
      wooPPAddress: '0x1df3009c57a8B143c6246149F00B090Bce3b8f88',
      wooOracleAddress: '0x25a4d4a094A084c7ad45Ac273cF7D6B6bfae7D4E',
      wooFeeManagerAddress: '0x209102c0D2E34282494114ea76D5251c8e7Ea7ab',
      wooGuardianAddress: '0x58c73f7e102bc6bcdc6b092ef0399b3e06d6b3e3',
      quoteToken: {
        // USDC
        address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
        decimals: 6,
      },
      baseTokens: {
        WAVAX: {
          address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
          decimals: 18,
        },
        ['WBTC.e']: {
          address: '0x50b7545627a5162F82A992c33b87aDc75187B218',
          decimals: 8,
        },
        ['WETH.e']: {
          address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
          decimals: 18,
        },
        ['WOO.e']: {
          address: '0xaBC9547B534519fF73921b1FBA6E672b5f58D083',
          decimals: 18,
        },
      },
    },
    [Network.FANTOM]: {
      wooPPAddress: '0x9503E7517D3C5bc4f9E4A1c6AE4f8B33AC2546f2',
      wooOracleAddress: '0x209102c0D2E34282494114ea76D5251c8e7Ea7ab',
      wooFeeManagerAddress: '0xBE1a0FccCFA9c9065152B7770B918f7C59914E8D',
      wooGuardianAddress: '0x128758d0e909624841AB29D53919646BFBDa5dB2',
      quoteToken: {
        // USDC
        address: '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
        decimals: 6,
      },
      baseTokens: {
        WFTM: {
          address: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
          decimals: 18,
        },
        BTC: {
          address: '0x321162Cd933E2Be498Cd2267a90534A804051b11',
          decimals: 8,
        },
        ETH: {
          address: '0x74b23882a30290451A17c44f4F05243b6b58C76d',
          decimals: 18,
        },
        WOO: {
          address: '0x6626c47c00F1D87902fc13EECfaC3ed06D5E8D8a',
          decimals: 18,
        },
      },
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.BSC]: { [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 13 }] },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 12 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 8 }],
  },
};
