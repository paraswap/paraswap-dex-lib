import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter01',
        index: 4,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter01',
        index: 4,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'PolygonBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [
      {
        name: 'BscAdapter01',
        index: 3,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BscBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 2,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'AvalancheBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [
      {
        name: 'FantomAdapter01',
        index: 2,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'FantomBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [
      {
        name: 'ArbitrumAdapter01',
        index: 2,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'ArbitrumBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [
      {
        name: 'OptimismAdapter01',
        index: 2,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'OptimismBuyAdapter',
        index: 1,
      },
    ],
  },
  [Network.BASE]: {
    [SwapSide.SELL]: [
      {
        name: 'BaseAdapter01',
        index: 6,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'BaseBuyAdapter',
        index: 4,
      },
    ],
  },
};

export const RingV2Config: DexConfigMap<DexParams> = {
  RingV2: {
    [Network.MAINNET]: {
      subgraphURL: 'EYCKATKGBKLWvSfwvBjzfCBmGwYNdVkduYXVivCsLRFu',
      factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
    [Network.ARBITRUM]: {
      factoryAddress: '0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
    [Network.AVALANCHE]: {
      factoryAddress: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
    [Network.BSC]: {
      factoryAddress: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
    [Network.BASE]: {
      factoryAddress: '0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
    [Network.OPTIMISM]: {
      factoryAddress: '0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
    [Network.POLYGON]: {
      factoryAddress: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C',
      initCode:
        '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
    [Network.SEPOLIA]: {
      subgraphURL: 'QmZzsQGDmQFbzYkv2qx4pVnD6aVnuhKbD3t1ea7SAvV7zE',
      factoryAddress: '0x509166db8Fb9571F8C34EfcD7347809B34dE4e04',
      initCode:
        '0x7bb8e653f17062363b5ba1ef7e234a8df49ac9c5b8efa399b9771220727e9730',
      poolGasCost: 80 * 1000,
      feeCode: 30,
    },
  },
};
