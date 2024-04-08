import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';
import {
  AaveV2Avalanche,
  AaveV2Ethereum,
  AaveV2Polygon,
} from '@bgd-labs/aave-address-book';

export const aaveLendingPool: { [network: string]: string } = {
  [Network.MAINNET]: AaveV2Ethereum.POOL,
  [Network.POLYGON]: AaveV2Polygon.POOL,
  [Network.AVALANCHE]: AaveV2Avalanche.POOL,
};

export const WETH_GATEWAY: any = {
  [Network.MAINNET]: AaveV2Ethereum.WETH_GATEWAY,
  [Network.POLYGON]: AaveV2Polygon.WETH_GATEWAY,
  [Network.AVALANCHE]: AaveV2Avalanche.WETH_GATEWAY,
};

export const AaveV2Config: DexConfigMap<any> = {
  AaveV2: {
    [Network.MAINNET]: {},
    [Network.POLYGON]: {},
    [Network.AVALANCHE]: {},
  },
};

export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter01',
        index: 7,
      },
    ],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter01',
        index: 1,
      },
    ],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 7,
      },
    ],
  },
};
