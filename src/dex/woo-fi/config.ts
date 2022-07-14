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
      rebateTo: '0xcbb65ad3e64f404b5411486e15561bfb645ce642',
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
      rebateTo: '0x1bf4c97384e7bdc609017305edb23fd28c13e76a',
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
      rebateTo: '0xced122f9b99d224675eeda13f0c14639c5633f91',
    },
    [Network.POLYGON]: {
      wooPPAddress: '0x7400B665C8f4f3a951a99f1ee9872efb8778723d',
      wooOracleAddress: '0x2Fe5E5D341cFFa606a5d9DA1B6B646a381B0f7ec',
      wooFeeManagerAddress: '0x7214833BE05Ce39f6dCd97668e521162e6C18937',
      wooGuardianAddress: '0xF5d215d9C84778F85746D15762DaF39B9E83a2d6',
      quoteToken: {
        // USDC
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6,
      },
      baseTokens: {
        WMATIC: {
          address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
          decimals: 18,
        },
        WBTC: {
          address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
          decimals: 8,
        },
        WETH: {
          address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
          decimals: 18,
        },
        WOO: {
          address: '0x1B815d120B3eF02039Ee11dC2d33DE7aA4a8C603',
          decimals: 18,
        },
      },
      rebateTo: '0x0c84cd406b8a4e07df9a1b15ef348023a1dcd075',
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
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 4 }],
  },
};
