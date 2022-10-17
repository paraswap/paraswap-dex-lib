import { DexParams, PoolConfig } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { normalizeAddress } from '../../utils';

const CurveV1Config: DexConfigMap<DexParams> = {
  CurveV1: {
    [Network.MAINNET]: {
      factoryAddress: '0xB9fC157394Af804a3578134A6585C0dc9cc990d4',
      pools: {},
    },
    [Network.POLYGON]: {
      factoryAddress: '0x722272D36ef0Da72FF51c5A65Db7b870E2e8D4ee',
      pools: {},
    },
    [Network.FANTOM]: {
      factoryAddress: '0x686d67265703D1f124c45E33d47d794c566889Ba',
      pools: {},
    },
    [Network.AVALANCHE]: {
      factoryAddress: '0xb17b674D9c5CB2e441F8e196a2f048A81355d031',
      pools: {},
    },
    [Network.ARBITRUM]: {
      factoryAddress: '0xb17b674D9c5CB2e441F8e196a2f048A81355d031',
      pools: {},
    },
    [Network.OPTIMISM]: {
      factoryAddress: '0x2db0E83599a91b508Ac268a6197b8B14F5e72840',
      pools: {},
    },
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
      Object.keys(_config.pools).map(p => {
        _config.pools[p].address = _config.pools[p].address.toLowerCase();
      });

      const normalizedConfig: DexParams = {
        factoryAddress: _config.factoryAddress,
        pools: Object.entries(_config.pools).reduce<Record<string, PoolConfig>>(
          (acc, [poolName, poolConfig]) => {
            const normalizedPools: PoolConfig = {
              address: normalizeAddress(poolConfig.address),
              name: poolConfig.name.toLowerCase(),
              underlying: poolConfig.underlying.map(e => normalizeAddress(e)),
              coins: poolConfig.coins.map(e => normalizeAddress(e)),
              isLending: poolConfig.isLending,
              isMetapool: poolConfig.isMetapool,
            };

            acc[poolName.toLowerCase()] = normalizedPools;
            return acc;
          },
          {},
        ),
      };
      config[dexKey][+network] = normalizedConfig;
    }
  }
  return config;
};

configAddressesNormalizer(CurveV1Config);

export { CurveV1Config };
