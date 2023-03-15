import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const JarvisV6Config: DexConfigMap<DexParams> = {
  JarvisV6: {
    [Network.POLYGON]: {
      chainLinkProxies: {
        EURUSD: '0x73366Fe0AA0Ded304479862808e02506FE556a98',
        CHFUSD: '0xc76f762CedF0F78a439727861628E0fdfE1e70c2',
        GBPUSD: '0x099a2540848573e94fb1Ca0Fa420b00acbBc845a',
        PHPUSD: '0x218231089Bebb2A31970c3b77E96eCfb3BA006D1',
        SGDUSD: '0x8CE3cAc0E6635ce04783709ca3CC4F5fc5304299',
        CADUSD: '0xACA44ABb8B04D07D883202F99FA5E3c53ed57Fb5',
        JPYUSD: '0xD647a6fC9BC6402301583C91decC5989d8Bc382D',
        SEKUSD: '0xbd92B4919ae82be8473859295dEF0e778A626302',
        AUDUSD: '0x062Df9C4efd2030e243ffCc398b652e8b8F95C6f',
        CNYUSD: '0x04bB437Aa63E098236FA47365f0268547f6EAB32',
        NZDUSD: '0xa302a0B8a499fD0f00449df0a490DedE21105955',
        PLNUSD: '0xB34BCE11040702f71c11529D00179B2959BcE6C0',
        MXNUSD: '0x171b16562EA3476F5C61d1b8dad031DbA0768545',
        KRWUSD: '0x24B820870F726dA9B0D83B0B28a93885061dbF50',
        BRLUSD: '0xB90DA3ff54C3ED09115abf6FbA0Ff4645586af2c',
        XAUUSD: '0x0C466540B2ee1a31b441671eac0ca886e051E410',
        ETHUSD: '0xF9680D99D6C9589e2a93a78A04A279e509205945',
      },
      pools: [
        {
          pair: 'EURUSD',
          address: '0x65a7b4Ff684C2d08c115D55a4B089bf4E92F5003',
          syntheticToken: {
            symbol: 'jEUR',
            decimals: 18,
            address: '0x4e3Decbb3645551B8A19f0eA1678079FCB33fB4c',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'EURUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'EURETH',
          address: '0x162eD91cb79066B4fE7993c920E2e04f67Cf768E',
          syntheticToken: {
            symbol: 'jEUR',
            decimals: 18,
            address: '0x4e3Decbb3645551B8A19f0eA1678079FCB33fB4c',
          },
          collateralToken: {
            symbol: 'WETH',
            decimals: 18,
            address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
          },
          priceFeed: [
            {
              pair: 'EURUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
            {
              pair: 'ETHUSD',
              isReversePrice: true,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'CHFUSD',
          address: '0x8734CF40A402D4191BD4D7a64bEeF12E4c452DeF',
          syntheticToken: {
            symbol: 'jCHF',
            decimals: 18,
            address: '0xbD1463F02f61676d53fd183C2B19282BFF93D099',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'CHFUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'GBPUSD',
          address: '0x36d6D1d6249fbC6EBd0fC28fd46C846fB69b9074',
          syntheticToken: {
            symbol: 'jGBP',
            decimals: 18,
            address: '0x767058F11800FBA6A682E73A6e79ec5eB74Fac8c',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'GBPUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'PHPUSD',
          address: '0x8aE34663B4622336818e334dC42f92C41eFbfa35',
          syntheticToken: {
            symbol: 'jPHP',
            decimals: 18,
            address: '0x486880FB16408b47f928F472f57beC55AC6089d1',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'PHPUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'SGDUSD',
          address: '0xBE813590e1B191120f5df3343368f8a2F579514C',
          syntheticToken: {
            symbol: 'jSGD',
            decimals: 18,
            address: '0xa926db7a4CC0cb1736D5ac60495ca8Eb7214B503',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          priceFeed: [
            {
              pair: 'SGDUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'CADUSD',
          address: '0x06440a2DA257233790B5355322dAD82C10F0389A',
          syntheticToken: {
            address: '0x8ca194A3b22077359b5732DE53373D4afC11DeE3',
            decimals: 18,
            symbol: 'jCAD',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          priceFeed: [
            {
              pair: 'CADUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'JPYUSD',
          address: '0xAEc757BF73cc1f4609a1459205835Dd40b4e3F29',
          syntheticToken: {
            address: '0x8343091F2499FD4b6174A46D067A920a3b851FF9',
            decimals: 18,
            symbol: 'jJPY',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'JPYUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'SEKUSD',
          address: '0xc8442072CF1E131506eaC7df33eA8910e1d5cFDd',
          syntheticToken: {
            address: '0x197E5d6CcfF265AC3E303a34Db360ee1429f5d1A',
            decimals: 18,
            symbol: 'jSEK',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          priceFeed: [
            {
              pair: 'SEKUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'AUDUSD',
          address: '0x36572797Cc569A74731E0738Ef56e3b8ce3F309c',
          syntheticToken: {
            symbol: 'jAUD',
            decimals: 18,
            address: '0xCB7F1Ef7246D1497b985f7FC45A1A31F04346133',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'AUDUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'CNYUSD',
          address: '0x72E7Da7C0dD3C082Dfe8f22343D6AD70286e07bd',
          syntheticToken: {
            symbol: 'jCNY',
            decimals: 18,
            address: '0x84526c812D8f6c4fD6C1a5B68713AFF50733E772',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'CNYUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'NZDUSD',
          address: '0x4FDA1B4b16f5F2535482b91314018aE5A2fda602',
          syntheticToken: {
            symbol: 'jNZD',
            decimals: 18,
            address: '0x6b526Daf03B4C47AF2bcc5860B12151823Ff70E0',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'NZDUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'PLNUSD',
          address: '0x166e4B3Ec3F81F32f0863B9cD63621181d6bFED5',
          syntheticToken: {
            symbol: 'jPLN',
            decimals: 18,
            address: '0x08E6d1F0c4877Ef2993Ad733Fc6F1D022d0E9DBf',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'PLNUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'MXNUSD',
          address: '0x25E9F976f5020F6BF2d417b231e5f414b7700E31',
          syntheticToken: {
            symbol: 'jMXN',
            decimals: 18,
            address: '0xBD1fe73e1f12bD2bc237De9b626F056f21f86427',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'MXNUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'KRWUSD',
          address: '0x7aC6515f4772fcB6EEeF978f60D996B21C56089D',
          syntheticToken: {
            symbol: 'jKRW',
            decimals: 18,
            address: '0xa22f6bc96f13bcC84dF36109c973d3c0505a067E',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
          },
          priceFeed: [
            {
              pair: 'KRWUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'BRLUSD',
          address: '0x30E97dc680Ee97Ff65B5188d34Fb4EA20B38D710',
          syntheticToken: {
            address: '0xf2f77FE7b8e66571E0fca7104c4d670BF1C8d722',
            decimals: 18,
            symbol: 'jBRL',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          priceFeed: [
            {
              pair: 'BRLUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
        {
          pair: 'XAUUSD',
          address: '0x7a75624f051041baA74aE4E47724216307c7401D',
          syntheticToken: {
            symbol: 'jGOLD',
            decimals: 18,
            address: '0x192Ef3FFF1708456D3A1F21354FA8d6bFd86b45c',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          },
          priceFeed: [
            {
              pair: 'XAUUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
      ],
    },

    [Network.OPTIMISM]: {
      chainLinkProxies: {
        EURUSD: '0x3626369857A10CcC6cc3A6e4f5C2f5984a519F20',
      },
      pools: [
        {
          pair: 'EURUSD',
          address: '0xb145fB1ef8E3B0202af4012F6bebc00e6882a10D',
          syntheticToken: {
            symbol: 'jEUR',
            decimals: 18,
            address: '0x79AF5dd14e855823FA3E9ECAcdF001D99647d043',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
          },
          priceFeed: [
            {
              pair: 'EURUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
      ],
    },

    [Network.ARBITRUM]: {
      chainLinkProxies: {
        EURUSD: '0xA14d53bC1F1c0F31B4aA3BD109344E5009051a84',
      },
      pools: [
        {
          pair: 'EURUSD',
          address: '0xDb97f7a816E91a94eF936145E1b9faee14b8c25c',
          syntheticToken: {
            symbol: 'jEUR',
            decimals: 18,
            address: '0xAD435674417520aeeED6b504bBe654d4f556182F',
          },
          collateralToken: {
            symbol: 'USDC',
            decimals: 6,
            address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
          },
          priceFeed: [
            {
              pair: 'EURUSD',
              isReversePrice: false,
              proxy: '',
              aggregator: '',
            },
          ],
        },
      ],
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 5 }],
  },
};
