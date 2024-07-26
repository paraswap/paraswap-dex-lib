import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const UniswapV2Config: DexConfigMap<DexParams> = {
  SquadswapV2: {
    [Network.BSC]: {
      factoryAddress: '0x1D9F43a6195054313ac1aE423B1f810f593b6ac1',
      initCode:
        '0xd424455c1204e4f46a4a380651928652376a351698d3d97e2da05d3041c15fbe',
      poolGasCost: 80 * 1000,
      feeCode: 20,
      subgraphURL:
        'https://api.studio.thegraph.com/query/59394/exchangev2/version/latest',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
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
};
