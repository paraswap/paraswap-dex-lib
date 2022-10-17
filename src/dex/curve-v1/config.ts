import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

const CurveV1Config: DexConfigMap<DexParams> = {
  CurveV1: {
    // TODO: complete me!
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [
      {
        name: 'Adapter01',
        index: 3,
      },
    ],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [
      // use for beltfi
      {
        name: 'BscAdapter01',
        index: 2,
      },
    ],
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonAdapter01',
        index: 3,
      },
    ],
  },
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 5,
      },
    ],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [
      {
        name: 'FantomAdapter01',
        index: 3,
      },
    ],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [
      {
        name: 'ArbitrumAdapter01',
        index: 6,
      },
    ],
  },
  [Network.OPTIMISM]: {
    [SwapSide.SELL]: [
      {
        name: 'OptimismAdapter01',
        index: 5,
      },
    ],
  },
};

const configAddressesNormalizer = (
  config: DexConfigMap<DexParams>,
): DexConfigMap<DexParams> => {
  for (const [dexKey] of Object.keys(config)) {
    for (const [network] of Object.keys(config[dexKey])) {
      const _config = config[dexKey][+network];
      const normalizedConfig: DexParams = {};
      config[dexKey][+network] = normalizedConfig;
    }
  }
  return config;
};

configAddressesNormalizer(CurveV1Config);

export { CurveV1Config };
