import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const ParaSwapLimitOrdersConfig: DexConfigMap<DexParams> = {
  ParaSwapLimitOrders: {
    [Network.ROPSTEN]: {
      rfqAddress: '0x34268C38fcbC798814b058656bC0156C7511c0E4',
    },
    [Network.AVALANCHE]: {
      rfqAddress: '0x34302c4267d0dA0A8c65510282Cc22E9e39df51f',
    },
    [Network.BSC]: {
      rfqAddress: '0x8DcDfe88EF0351f27437284D0710cD65b20288bb',
    },
    [Network.FANTOM]: {
      rfqAddress: '0x2DF17455B96Dde3618FD6B1C3a9AA06D6aB89347',
    },
    [Network.MAINNET]: {
      rfqAddress: '0xe92b586627ccA7a83dC919cc7127196d70f55a06',
    },
    [Network.POLYGON]: {
      rfqAddress: '0xF3CD476C3C4D3Ac5cA2724767f269070CA09A043',
    },
    [Network.ARBITRUM]: {
      rfqAddress: '0x0927FD43a7a87E3E8b81Df2c44B03C4756849F6D',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 13 }],
    [SwapSide.BUY]: [{ name: 'AvalancheBuyAdapter', index: 2 }],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 14 }],
    [SwapSide.BUY]: [{ name: 'BscBuyAdapter', index: 2 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 9 }],
    [SwapSide.BUY]: [{ name: 'FantomBuyAdapter', index: 2 }],
  },
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter03', index: 10 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter', index: 6 }],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 2 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter', index: 3 }],
  },
  [Network.ROPSTEN]: {
    [SwapSide.SELL]: [{ name: 'RopstenAdapter01', index: 2 }],
    [SwapSide.BUY]: [{ name: 'RopstenBuyAdapter', index: 2 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter01', index: 13 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumAdapter01', index: 13 }],
  },
};
