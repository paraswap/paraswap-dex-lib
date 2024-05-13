import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const VirtuSwapConfig: DexConfigMap<DexParams> = {
  VirtuSwap: {
    [Network.POLYGON]: {
      factoryAddress: '0xd4E3668A9C39ebB603f02A6987fC915dBC906B43',
      vPoolManagerAddress: '0x2F5BAbA26070C548D424345B2bEc05943F633FaB',
      initCode:
        '0x637bc1e6555f050fef1c3804f2f03647a960ac0a39ac52c519c3c6d9da312ae0',
      router: '0x3E3d15ea98429E546f30215AEfBB69A4244A8Ea9',
      isTimestampBased: false,
      realPoolGasCost: 265 * 1000,
      virtualPoolGasCost: 365 * 1000,
      getTokensURL: 'https://api.virtuswap.io/graph/tokens?chainId=137',
      getTokensPricesURL:
        'https://api.virtuswap.io/tokensPricesUsd?chainId=137',
    },
    [Network.ARBITRUM]: {
      factoryAddress: '0x389DB0B69e74A816f1367aC081FdF24B5C7C2433',
      vPoolManagerAddress: '0x0DFb6f538b0A8eDfB5aF03a47144b942004b1a26',
      initCode:
        '0x759724dfe39927d24bcfec0e232ca16e126330842301d9947db2223f5ddca426',
      router: '0xB455da5a32E7E374dB6d1eDfdb86C167DD983f40',
      isTimestampBased: true,
      realPoolGasCost: 345 * 1000, // Tenderly shows much higher values for Arbitrum for unknown reasons
      virtualPoolGasCost: 555 * 1000, // Tenderly shows much higher values for Arbitrum for unknown reasons
      getTokensURL: 'https://api.virtuswap.io/graph/tokens?chainId=42161',
      getTokensPricesURL:
        'https://api.virtuswap.io/tokensPricesUsd?chainId=42161',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [
      {
        name: 'PolygonVirtuSwapAdapter',
        index: 1,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'PolygonVirtuSwapAdapter',
        index: 1,
      },
    ],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [
      {
        name: 'ArbitrumVirtuSwapAdapter',
        index: 1,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'ArbitrumVirtuSwapAdapter',
        index: 1,
      },
    ],
  },
};
