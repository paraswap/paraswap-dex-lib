import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Interface } from '@ethersproject/abi';
import ChainlinkAccessControlledOffchainAggregatorABI from '../../abi/jarvis/ChainlinkAccessControlledOffchainAggregator.json';
import SynthereumPriceFeedABI from '../../abi/jarvis/SynthereumPriceFeed.json';

export const JarvisV6Config: DexConfigMap<DexParams> = {
  JarvisV6: {
    [Network.POLYGON]: {
      priceFeed: {
        interface: new Interface(SynthereumPriceFeedABI),
        address: '0x12F513D977B47D1d155bC5ED4d295c1B10D6D027',
      },
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
          chainLink: {
            interface: new Interface(
              ChainlinkAccessControlledOffchainAggregatorABI,
            ),
            address: '0x310990E8091b5cF083fA55F500F140CFBb959016',
          },
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
          chainLink: {
            interface: new Interface(
              ChainlinkAccessControlledOffchainAggregatorABI,
            ),
            address: '0x8123bEaCB5bca3AfA0C9ff71B28549d58cEc8176',
          },
        },
      ],
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 0 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 1 }],
  },
};
