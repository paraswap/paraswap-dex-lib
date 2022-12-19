import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WstETHConfig: DexConfigMap<DexParams> = {
  wstETH: {
    [Network.MAINNET]: {
      wstETHAddress: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
      stETHAddress: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: 'Adapter03', index: 12 }] },
};
