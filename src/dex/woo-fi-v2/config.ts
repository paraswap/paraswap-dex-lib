import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WooFiV2Config: DexConfigMap<DexParams> = {
  WooFiV2: {
    [Network.OPTIMISM]: {
      wooPPV2Address: '0xd1778F9DF3eee5473A9640f13682e3846f61fEbC',
      wooOracleV2Address: '0xd589484d3A27B7Ce5C2C7F829EB2e1D163f95817',
      integrationHelperAddress: '0x96329d66074EB8386Ae8bFD6698B2E3FDA87e15E',
      // USDC
      quoteToken: {
        address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        decimals: 6,
      },
    },
    [Network.BSC]: {
      wooPPV2Address: '0x59dE3B49314Bf5067719364A2Cb43e8525ab93FA',
      wooOracleV2Address: '0x72dc7fa5eeb901a34173C874A7333c8d1b34bca9',
      integrationHelperAddress: '0xAA9c15cd603428cA8ddD45e933F8EfE3Afbcc173',
      // USDT
      quoteToken: {
        address: '0x55d398326f99059fF775485246999027B3197955',
        decimals: 18,
      },
    },
    [Network.POLYGON]: {
      wooPPV2Address: '0x7081A38158BD050Ae4a86e38E0225Bc281887d7E',
      wooOracleV2Address: '0x31aE608cBadD1214D6A3d5dcf49E45Fb18E2a48E',
      integrationHelperAddress: '0x7Ba560eB735AbDCf9a3a5692272652A0cc81850d',
      // USDC
      quoteToken: {
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6,
      },
    },
    [Network.FANTOM]: {
      wooPPV2Address: '0x286ab107c5E9083dBed35A2B5fb0242538F4f9bf',
      wooOracleV2Address: '0xB1d022F8F3e43868DaaDfa7040e63781C16aB4A6',
      integrationHelperAddress: '0x6641959FE5EED7166F2254cF04b0d20c96776D9A',
      // USDC
      quoteToken: {
        address: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
        decimals: 6,
      },
    },
    [Network.ARBITRUM]: {
      wooPPV2Address: '0xeFF23B4bE1091b53205E35f3AfCD9C7182bf3062',
      wooOracleV2Address: '0x73504eaCB100c7576146618DC306c97454CB3620',
      integrationHelperAddress: '0x28D2B949024FE50627f1EbC5f0Ca3Ca721148E40',
      // USDC
      quoteToken: {
        address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        decimals: 6,
      },
    },
    [Network.AVALANCHE]: {
      wooPPV2Address: '0x3b3E4b4741e91aF52d0e9ad8660573E951c88524',
      wooOracleV2Address: '0xc13843aE0D2C5ca9E0EfB93a78828446D8173d19',
      integrationHelperAddress: '0x020630613E296c3E9b06186f630D1bF97A2B6Ad1',
      // USDC
      quoteToken: {
        address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        decimals: 6,
      },
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [{ name: 'OptimismAdapter01', index: 11 }],
  },
  [Network.BSC]: { [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 13 }] },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 4 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 8 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter02', index: 3 }],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 12 }],
  },
};
