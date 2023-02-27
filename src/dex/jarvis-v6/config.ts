import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Interface } from '@ethersproject/abi';
import SynthereumPriceFeedABI from '../../abi/jarvis/SynthereumPriceFeed.json';

export const JarvisV6Config: DexConfigMap<DexParams> = {
  JarvisV6: {
    [Network.POLYGON]: {
      priceFeedAddress: '0x12F513D977B47D1d155bC5ED4d295c1B10D6D027',
      pools: [
        {
          address: '0x65a7b4Ff684C2d08c115D55a4B089bf4E92F5003',
          priceFeedPair: 'EURUSD',
          syntheticToken: {
            address: '0x4e3Decbb3645551B8A19f0eA1678079FCB33fB4c',
            decimals: 18,
            symbol: 'jEUR',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0x310990E8091b5cF083fA55F500F140CFBb959016',
        },
        {
          address: '0x8734CF40A402D4191BD4D7a64bEeF12E4c452DeF',
          priceFeedPair: 'CHFUSD',
          syntheticToken: {
            address: '0xbD1463F02f61676d53fd183C2B19282BFF93D099',
            decimals: 18,
            symbol: 'jCHF',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0x8123bEaCB5bca3AfA0C9ff71B28549d58cEc8176',
        },
        {
          address: '0x36d6D1d6249fbC6EBd0fC28fd46C846fB69b9074',
          priceFeedPair: 'GBPUSD',
          syntheticToken: {
            address: '0x767058F11800FBA6A682E73A6e79ec5eB74Fac8c',
            decimals: 18,
            symbol: 'jGBP',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0x3F7f90e0f782E325401f6323BA93E717f519F382',
        },
        {
          address: '0x8aE34663B4622336818e334dC42f92C41eFbfa35',
          priceFeedPair: 'PHPUSD',
          syntheticToken: {
            address: '0x486880FB16408b47f928F472f57beC55AC6089d1',
            decimals: 18,
            symbol: 'jPHP',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0x8a2355ec4678186164dc17dfc2c5d0d083d7fd66',
        },
        {
          address: '0xBE813590e1B191120f5df3343368f8a2F579514C',
          priceFeedPair: 'SGDUSD',
          syntheticToken: {
            address: '0xa926db7a4CC0cb1736D5ac60495ca8Eb7214B503',
            decimals: 18,
            symbol: 'jSGD',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0x45ede0ea5cbbe380c663c7c3015cc7c986669fec',
        },
        {
          address: '0x06440a2DA257233790B5355322dAD82C10F0389A',
          priceFeedPair: 'CADUSD',
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
          chainLinkAggregatorAddress:
            '0x88b79bfce730bbb74f23ab8940b37b86859caa2e',
        },
        {
          address: '0xAEc757BF73cc1f4609a1459205835Dd40b4e3F29',
          priceFeedPair: 'JPYUSD',
          syntheticToken: {
            address: '0x8343091F2499FD4b6174A46D067A920a3b851FF9',
            decimals: 18,
            symbol: 'jJPY',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0xeaf35f06410014234bee87980a902c21f78cb426',
        },
        {
          address: '0xc8442072CF1E131506eaC7df33eA8910e1d5cFDd',
          priceFeedPair: 'SEKUSD',
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
          chainLinkAggregatorAddress:
            '0x542d2af7f89a61205f3da2d3d13e29b56bde7b46',
        },
        {
          address: '0x36572797Cc569A74731E0738Ef56e3b8ce3F309c',
          priceFeedPair: 'AUDUSD',
          syntheticToken: {
            address: '0xCB7F1Ef7246D1497b985f7FC45A1A31F04346133',
            decimals: 18,
            symbol: 'jAUD',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0x0a9823c5cd84099fde8566a1adf0f2bb41cc6e7d',
        },
        {
          address: '0x72E7Da7C0dD3C082Dfe8f22343D6AD70286e07bd',
          priceFeedPair: 'CNYUSD',
          syntheticToken: {
            address: '0x84526c812D8f6c4fD6C1a5B68713AFF50733E772',
            decimals: 18,
            symbol: 'jCNY',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0xf07eac7a48eb772613479d6a8fc42675f1befb47',
        },
        {
          address: '0x4FDA1B4b16f5F2535482b91314018aE5A2fda602',
          priceFeedPair: 'NZDUSD',
          syntheticToken: {
            address: '0x6b526Daf03B4C47AF2bcc5860B12151823Ff70E0',
            decimals: 18,
            symbol: 'jNZD',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0xe63032a70f6eb617970829fbfa365d7c44bdbbbf',
        },
        {
          address: '0x166e4B3Ec3F81F32f0863B9cD63621181d6bFED5',
          priceFeedPair: 'PLNUSD',
          syntheticToken: {
            address: '0x08E6d1F0c4877Ef2993Ad733Fc6F1D022d0E9DBf',
            decimals: 18,
            symbol: 'jPLN',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0x08f8d217e6f07ae423a2ad2ffb226ffcb577708d',
        },
        {
          address: '0x25E9F976f5020F6BF2d417b231e5f414b7700E31',
          priceFeedPair: 'MXNUSD',
          syntheticToken: {
            address: '0xBD1fe73e1f12bD2bc237De9b626F056f21f86427',
            decimals: 18,
            symbol: 'jMXN',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0x2e2ed40fc4f1774def278830f8fe3b6e77956ec8',
        },
        {
          address: '0x7aC6515f4772fcB6EEeF978f60D996B21C56089D',
          priceFeedPair: 'KRWUSD',
          syntheticToken: {
            address: '0xa22f6bc96f13bcC84dF36109c973d3c0505a067E',
            decimals: 18,
            symbol: 'jKRW',
          },
          collateralToken: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0xfd54f97a6c408561b5df798c04ae08b27ca0d7f7',
        },
        {
          address: '0x30E97dc680Ee97Ff65B5188d34Fb4EA20B38D710',
          priceFeedPair: 'BRLUSD',
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
          chainLinkAggregatorAddress:
            '0x6DBd1be1a83005d26b582D61937b406300B05A8F',
        },
        {
          address: '0x7a75624f051041baA74aE4E47724216307c7401D',
          priceFeedPair: 'XAUUSD',
          syntheticToken: {
            address: '0x192Ef3FFF1708456D3A1F21354FA8d6bFd86b45c',
            decimals: 18,
            symbol: 'jGOLD',
          },
          collateralToken: {
            address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0x704179beB09282EaEf98CA8aaa443C1E273eBBc2',
        },
      ],
    },
    [Network.OPTIMISM]: {
      priceFeedAddress: '0xd8D32702c398528904e1367999f1563Eb4DF731a',
      pools: [
        {
          address: '0xb145fB1ef8E3B0202af4012F6bebc00e6882a10D',
          priceFeedPair: 'EURUSD',
          syntheticToken: {
            address: '0x79AF5dd14e855823FA3E9ECAcdF001D99647d043',
            decimals: 18,
            symbol: 'jEUR',
          },
          collateralToken: {
            address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0xAA75acE4575AbBE1D237D991a7461f497a56a8F0',
        },
      ],
    },
    [Network.ARBITRUM]: {
      priceFeedAddress: '0x1505319B24538d05EC26794A602E316fA314876A',
      pools: [
        {
          address: '0xDb97f7a816E91a94eF936145E1b9faee14b8c25c',
          priceFeedPair: 'EURUSD',
          syntheticToken: {
            address: '0xAD435674417520aeeED6b504bBe654d4f556182F',
            decimals: 18,
            symbol: 'jEUR',
          },
          collateralToken: {
            address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
            decimals: 6,
            symbol: 'USDC',
          },
          chainLinkAggregatorAddress:
            '0x7AAeE6aD40a947A162DEAb5aFD0A1e12BE6FF871',
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
