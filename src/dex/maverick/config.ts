import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const MaverickConfig: DexConfigMap<DexParams> = {
  Maverick: {
    [Network.POLYGON]: {
      subgraphURL:
        'https://api.thegraph.com/subgraphs/name/maverickprotocol/swap-polygon',
      factoryAddress: '0x09d267428cA6D221c64f343B3Af07446603F22C2',
      routerAddress: '0x6F9014366DccAd9323247DA44518212C0572C80A',
      estimatorAddress: '0x631b13a4C20705c067Fe5Cd1867C955B0D19C636',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 5 }],
  },
};
