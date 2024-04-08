import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const Config: DexConfigMap<DexParams> = {
  IdleDao: {
    [Network.MAINNET]: {
      fromBlock: 13244388,
      lendingGasCost: 328 * 1000,
      factoryAddress: '0x3c9916bb9498f637e2fa86c2028e26275dc9a631',
    },
    /*
    [Network.OPTIMISM]: {
      fromBlock: 110449062,
      factoryAddress: '0x8aA1379e46A8C1e9B7BB2160254813316b5F35B8',
    },
    [Network.ZKEVM]: {
      fromBlock: 2812767,
      factoryAddress: '0xba43DE746840eD16eE53D26af0675d8E6c24FE38',
    },
    */
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
  // [Network.OPTIMISM]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
  // [Network.ZKEVM]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
