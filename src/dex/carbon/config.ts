import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const CarbonConfig: DexConfigMap<DexParams> = {
  Carbon: {
    [Network.MAINNET]: {
      subgraphURL:
        'https://api.studio.thegraph.com/query/46118/carbon-test/version/latest',
      carbonController: '0xC537e898CD774e2dCBa3B14Ea6f34C93d5eA45e1',
      voucher: '0x3660F04B79751e31128f6378eAC70807e38f554E',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
