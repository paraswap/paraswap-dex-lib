import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WooFiV2Config: DexConfigMap<DexParams> = {
  WooFiV2: {
    [Network.OPTIMISM]: {
      wooPPV2Address: '0xd1778F9DF3eee5473A9640f13682e3846f61fEbC',
      wooOracleV2Address: '0x464959aD46e64046B891F562cFF202a465D522F3',
      integrationHelperAddress: '0x96329d66074EB8386Ae8bFD6698B2E3FDA87e15E',
      // USDC
      quoteToken: {
        address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
        decimals: 6,
      },
    },
    [Network.BSC]: {
      wooPPV2Address: '0xEc054126922a9a1918435c9072c32f1B60cB2B90',
      wooOracleV2Address: '0x747f99D619D5612399010Ec5706F13e3345c4a9E',
      integrationHelperAddress: '0xe12dC1F01ccB71ef00ADd1D8A5116b905261D879',
      // BUSD
      quoteToken: {
        address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        decimals: 18,
      },
    },
    [Network.POLYGON]: {
      wooPPV2Address: '0x7081A38158BD050Ae4a86e38E0225Bc281887d7E',
      wooOracleV2Address: '0xeFF23B4bE1091b53205E35f3AfCD9C7182bf3062',
      integrationHelperAddress: '0x7Ba560eB735AbDCf9a3a5692272652A0cc81850d',
      // USDC
      quoteToken: {
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6,
      },
    },
    [Network.FANTOM]: {
      wooPPV2Address: '0x286ab107c5E9083dBed35A2B5fb0242538F4f9bf',
      wooOracleV2Address: '0x8840e26e0ebf7D100A0644DD8576DC62B03cbf04',
      integrationHelperAddress: '0x6641959FE5EED7166F2254cF04b0d20c96776D9A',
      // USDC
      quoteToken: {
        address: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
        decimals: 6,
      },
    },
    [Network.ARBITRUM]: {
      wooPPV2Address: '0xeFF23B4bE1091b53205E35f3AfCD9C7182bf3062',
      wooOracleV2Address: '0x37a9dE70b6734dFCA54395D8061d9411D9910739',
      integrationHelperAddress: '0x28D2B949024FE50627f1EbC5f0Ca3Ca721148E40',
      // USDC
      quoteToken: {
        address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        decimals: 6,
      },
    },
    [Network.AVALANCHE]: {
      wooPPV2Address: '0x3b3E4b4741e91aF52d0e9ad8660573E951c88524',
      wooOracleV2Address: '0x9ACA557590F5020BDA4Ba63065Fc3A1253Bf8000',
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

  // TODO: Deploy new adapter for WooFiV2 on new chains and update this config
};
