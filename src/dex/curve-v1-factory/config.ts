import {
  CustomImplementationNames,
  DexParams,
  FactoryPoolImplementations,
  ImplementationNames,
} from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { normalizeAddress } from '../../utils';

const CurveV1FactoryConfig: DexConfigMap<DexParams> = {
  CurveV1Factory: {
    [Network.MAINNET]: {
      factoryAddress: '0xB9fC157394Af804a3578134A6585C0dc9cc990d4',
      stateUpdateFrequencyMs: 5 * 1000,
      factoryPoolImplementations: {
        '0x5f890841f657d90e081babdb532a05996af79fe6': {
          name: ImplementationNames.FACTORY_META_3POOL_2_8,
          address: '0x5f890841f657d90e081babdb532a05996af79fe6',
          isWrapNative: false,
          basePoolAddress: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
          isFeeOnTransferSupported: false,
        },
        '0x213be373fdff327658139c7df330817dad2d5bbe': {
          name: ImplementationNames.FACTORY_META_3POOL_2_15,
          address: '0x213be373fdff327658139c7df330817dad2d5bbe',
          isWrapNative: false,
          basePoolAddress: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
          isFeeOnTransferSupported: false,
        },
        '0x55aa9bf126bcabf0bdc17fa9e39ec9239e1ce7a9': {
          name: ImplementationNames.FACTORY_META_3POOL_FEE_TRANSFER,
          address: '0x55aa9bf126bcabf0bdc17fa9e39ec9239e1ce7a9',
          isWrapNative: false,
          basePoolAddress: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7',
          isFeeOnTransferSupported: true,
        },
        '0x33bb0e62d5e8c688e645dd46dfb48cd613250067': {
          name: ImplementationNames.FACTORY_META_FRAX,
          address: '0x33bb0e62d5e8c688e645dd46dfb48cd613250067',
          isWrapNative: false,
          basePoolAddress: '0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2',
          isFeeOnTransferSupported: false,
        },
        '0x2eb24483ef551da247ab87cf18e1cc980073032d': {
          name: ImplementationNames.FACTORY_META_FRAX_FEE_TRANSFER,
          address: '0x2eb24483ef551da247ab87cf18e1cc980073032d',
          isWrapNative: false,
          basePoolAddress: '0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2',
          isFeeOnTransferSupported: true,
        },
        '0xecaaecd9d2193900b424774133b1f51ae0f29d9e': {
          name: ImplementationNames.FACTORY_META_RENBTC,
          address: '0xecaaecd9d2193900b424774133b1f51ae0f29d9e',
          isWrapNative: false,
          basePoolAddress: '0x93054188d876f558f4a66B2EF1d97d16eDf0895B',
          isFeeOnTransferSupported: false,
        },
        '0x40fd58d44cfe63e8517c9bb3ac98676838ea56a8': {
          name: ImplementationNames.FACTORY_META_RENBTC_FEE_TRANSFER,
          address: '0x40fd58d44cfe63e8517c9bb3ac98676838ea56a8',
          isWrapNative: false,
          basePoolAddress: '0x93054188d876f558f4a66B2EF1d97d16eDf0895B',
          isFeeOnTransferSupported: true,
        },
        '0xc6a8466d128fbfd34ada64a9fffce325d57c9a52': {
          name: ImplementationNames.FACTORY_META_SBTC,
          address: '0xc6a8466d128fbfd34ada64a9fffce325d57c9a52',
          isWrapNative: false,
          basePoolAddress: '0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714',
          isFeeOnTransferSupported: false,
        },
        '0xc4c78b08fa0c3d0a312605634461a88184ecd630': {
          name: ImplementationNames.FACTORY_META_SBTC_FEE_TRANSFER,
          address: '0xc4c78b08fa0c3d0a312605634461a88184ecd630',
          isWrapNative: false,
          basePoolAddress: '0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714',
          isFeeOnTransferSupported: true,
        },
        '0x6523ac15ec152cb70a334230f6c5d62c5bd963f1': {
          name: ImplementationNames.FACTORY_PLAIN_2COIN_ERC20,
          address: '0x6523ac15ec152cb70a334230f6c5d62c5bd963f1',
          isWrapNative: false,
          isFeeOnTransferSupported: false,
        },
        '0x4a4d7868390ef5cac51cda262888f34bd3025c3f': {
          name: ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_18DEC,
          address: '0x4a4d7868390ef5cac51cda262888f34bd3025c3f',
          isWrapNative: false,
          isFeeOnTransferSupported: false,
        },
        '0x24d937143d3f5cf04c72ba112735151a8cae2262': {
          name: ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_FEE_TRANSFER,
          address: '0x24d937143d3f5cf04c72ba112735151a8cae2262',
          isWrapNative: true,
          isFeeOnTransferSupported: true,
        },
        '0x6326debbaa15bcfe603d831e7d75f4fc10d9b43e': {
          name: ImplementationNames.FACTORY_PLAIN_2COIN_NATIVE,
          address: '0x6326debbaa15bcfe603d831e7d75f4fc10d9b43e',
          isWrapNative: false,
          isFeeOnTransferSupported: false,
        },
        '0x9b52f13df69d79ec5aab6d1ace3157d29b409cc3': {
          name: ImplementationNames.FACTORY_PLAIN_3COIN_ERC20,
          address: '0x9b52f13df69d79ec5aab6d1ace3157d29b409cc3',
          isWrapNative: false,
          isFeeOnTransferSupported: false,
        },
        '0xe5f4b89e0a16578b3e0e7581327bdb4c712e44de': {
          name: ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_18DEC,
          address: '0xe5f4b89e0a16578b3e0e7581327bdb4c712e44de',
          isWrapNative: false,
          isFeeOnTransferSupported: false,
        },
        '0x50b085f2e5958c4a87baf93a8ab79f6bec068494': {
          name: ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_FEE_TRANSFER,
          address: '0x50b085f2e5958c4a87baf93a8ab79f6bec068494',
          isWrapNative: false,
          isFeeOnTransferSupported: true,
        },
        '0x8c1ab78601c259e1b43f19816923609dc7d7de9b': {
          name: ImplementationNames.FACTORY_PLAIN_3COIN_NATIVE,
          address: '0x8c1ab78601c259e1b43f19816923609dc7d7de9b',
          isWrapNative: false,
          isFeeOnTransferSupported: true,
        },
        '0x5bd47ea4494e0f8de6e3ca10f1c05f55b72466b8': {
          name: ImplementationNames.FACTORY_PLAIN_4COIN_ERC20,
          address: '0x5bd47ea4494e0f8de6e3ca10f1c05f55b72466b8',
          isWrapNative: false,
          isFeeOnTransferSupported: false,
        },
        '0xad4753d045d3aed5c1a6606dfb6a7d7ad67c1ad7': {
          name: ImplementationNames.FACTORY_PLAIN_4COIN_ERC20_18DEC,
          address: '0xad4753d045d3aed5c1a6606dfb6a7d7ad67c1ad7',
          isWrapNative: false,
          isFeeOnTransferSupported: false,
        },
      },
      customPools: {
        [CustomImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: {
          name: CustomImplementationNames.CUSTOM_PLAIN_2COIN_FRAX,
          address: '0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2',
          lpTokenAddress: '0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC',
          isWrapNative: false,
          liquidityApiSlug: '/main',
        },
        [CustomImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: {
          name: CustomImplementationNames.CUSTOM_PLAIN_3COIN_SBTC,
          address: '0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714',
          lpTokenAddress: '0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3',
          isWrapNative: false,
          liquidityApiSlug: '/main',
        },
        [CustomImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: {
          name: CustomImplementationNames.CUSTOM_PLAIN_3COIN_THREE,
          address: '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
          lpTokenAddress: '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490',
          isWrapNative: false,
          liquidityApiSlug: '/main',
        },
        [CustomImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: {
          name: CustomImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC,
          address: '0x93054188d876f558f4a66B2EF1d97d16eDf0895B',
          lpTokenAddress: '0x49849C98ae39Fff122806C06791Fa73784FB3675',
          isWrapNative: false,
          liquidityApiSlug: '/main',
        },
      },
    },
    [Network.POLYGON]: {
      factoryAddress: '0x722272D36ef0Da72FF51c5A65Db7b870E2e8D4ee',
      stateUpdateFrequencyMs: 2 * 1000,
      factoryPoolImplementations: {},
      customPools: {},
    },
    [Network.FANTOM]: {
      factoryAddress: '0x686d67265703D1f124c45E33d47d794c566889Ba',
      stateUpdateFrequencyMs: 2 * 1000,
      factoryPoolImplementations: {},
      customPools: {},
    },
    [Network.AVALANCHE]: {
      factoryAddress: '0xb17b674D9c5CB2e441F8e196a2f048A81355d031',
      stateUpdateFrequencyMs: 2 * 1000,
      factoryPoolImplementations: {},
      customPools: {},
    },
    [Network.ARBITRUM]: {
      factoryAddress: '0xb17b674D9c5CB2e441F8e196a2f048A81355d031',
      stateUpdateFrequencyMs: 2 * 1000,
      factoryPoolImplementations: {},
      customPools: {},
    },
    [Network.OPTIMISM]: {
      factoryAddress: '0x2db0E83599a91b508Ac268a6197b8B14F5e72840',
      stateUpdateFrequencyMs: 2 * 1000,
      factoryPoolImplementations: {},
      customPools: {},
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
  for (const dexKey of Object.keys(config)) {
    for (const network of Object.keys(config[dexKey])) {
      const _config = config[dexKey][+network];

      Object.keys(_config.customPools).forEach(p => {
        _config.customPools[p].address =
          _config.customPools[p].address.toLowerCase();
        _config.customPools[p].lpTokenAddress =
          _config.customPools[p].lpTokenAddress.toLowerCase();
      });

      // Had to recreate object to change key to lower case
      const factoryPoolImplementations = Object.entries(
        _config.factoryPoolImplementations,
      ).reduce<Record<string, FactoryPoolImplementations>>(
        (acc, [implementationAddress, implementationConfig]) => {
          const normalizedImplementation: FactoryPoolImplementations = {
            name: implementationConfig.name,
            address: normalizeAddress(implementationConfig.address),
            isWrapNative: implementationConfig.isWrapNative,
            isFeeOnTransferSupported:
              implementationConfig.isFeeOnTransferSupported,
            basePoolAddress: implementationConfig.basePoolAddress
              ? implementationConfig.basePoolAddress.toLowerCase()
              : undefined,
          };
          acc[implementationAddress.toLowerCase()] = normalizedImplementation;
          return acc;
        },
        {},
      );

      const normalizedConfig: DexParams = {
        factoryAddress: _config.factoryAddress
          ? _config.factoryAddress.toLowerCase()
          : _config.factoryAddress,
        stateUpdateFrequencyMs: _config.stateUpdateFrequencyMs,
        factoryPoolImplementations,
        customPools: _config.customPools,
      };
      config[dexKey][+network] = normalizedConfig;
    }
  }
  return config;
};

configAddressesNormalizer(CurveV1FactoryConfig);

export { CurveV1FactoryConfig };
