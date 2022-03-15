import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { SwapSide } from 'paraswap-core';

const WethGasCost = 50 * 1000;

export const WethConfig: DexConfigMap<DexParams> = {
  Weth: {
    [Network.MAINNET]: {
      contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      poolGasCost: WethGasCost,
    },
    [Network.ROPSTEN]: {
      contractAddress: '0xc778417e063141139fce010982780140aa0cd5ab',
      poolGasCost: WethGasCost,
    },
    [Network.RINKEBY]: {
      contractAddress: '0xc778417e063141139fce010982780140aa0cd5ab',
      poolGasCost: WethGasCost,
    },
  },
  Wbnb: {
    [Network.BSC]: {
      contractAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      poolGasCost: WethGasCost,
    },
  },
  Wmatic: {
    [Network.POLYGON]: {
      contractAddress: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      poolGasCost: WethGasCost,
    },
  },
  Wavax: {
    [Network.AVALANCHE]: {
      contractAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
      poolGasCost: WethGasCost,
    },
  },
  Wftm: {
    [Network.FANTOM]: {
      contractAddress: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
      poolGasCost: WethGasCost,
    },
  },
};

export const Adapters: {
  [chainId: number]: {
    [side: string]: { name: string; index: number }[];
  };
} = {
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [{ name: 'AvalancheAdapter01', index: 1 }],
  },
  [Network.BSC]: { [SwapSide.SELL]: [{ name: 'BscAdapter01', index: 1 }] },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 1 }],
  },
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: 'Adapter02', index: 5 }] },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter01', index: 2 }],
  },
};
