import { AdapterMappings, DexConfigMap } from '../../../types';
import { DexParams } from '../types';
import { Network, SwapSide } from '../../../constants';

export const DystopiaConfig: DexConfigMap<DexParams> = {
  Dystopia: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/dystopia-exchange/dystopia-v2',
      factoryAddress: '0x1d21Db6cde1b18c7E47B0F7F42f4b3F68b9beeC9',
      // ParaSwap-compatible Router with stable pools support
      router: '0x0E98A8e5ca6067B98d10Eb6476ec30E232346402',
      initCode:
        '0x009bce6d7eb00d3d075e5bd9851068137f44bba159f1cde806a268e20baaf2e8',
      feeCode: 5,
      poolGasCost: 180 * 1000,
    },
  },
  SpiritSwapV2: {
    [Network.FANTOM]: {
      factoryAddress: '0x9d3591719038752db0c8bEEe2040FfcC3B2c6B9c',
      // ParaSwap-compatible Router with stable pools support
      // TODO: Update router address once it is deployed
      router: '0x0E98A8e5ca6067B98d10Eb6476ec30E232346402',
      initCode:
        '0x5442fb448d86f32a7d2a9dc1a457e64bf5a6c77415d98802aac4fb5a9dc5ecd9',
      stableFee: 2000,
      volatileFee: 500,
      poolGasCost: 180 * 1000,

      // TODO: Not correct, need to update implementation for event based
      feeCode: 2000,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 3 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 10 }],
  },
};
