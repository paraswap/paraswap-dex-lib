import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const ClaystackConfig: DexConfigMap<DexParams> = {
  Claystack: {
    [Network.MAINNET]: {
      csETH: '0x5d74468b69073f809D4FaE90AfeC439e69Bf6263',
      clayMain: '0x331312DAbaf3d69138c047AaC278c9f9e0E8FFf8',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
