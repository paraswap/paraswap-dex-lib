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
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 3 }],
  },
  [Network.FANTOM]: {
    [SwapSide.SELL]: [{ name: 'FantomAdapter01', index: 10 }],
  },
};
