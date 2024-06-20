import { DexParams } from './types';
import { AdapterMappings, DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const InceptionConfig: DexConfigMap<DexParams> = {
  instETH: {
    [Network.MAINNET]: {
      vault: '0x814CC6B8fd2555845541FB843f37418b05977d8d',
      baseTokenSlug: 'STETH',
    },
  },
  // inETH: {
  //   [Network.MAINNET]: {
  //     vault: "0xf073bAC22DAb7FaF4a3Dd6c6189a70D54110525C",
  //     baseTokenSlug: "ETH",
  //   },
  // },
};

export const Adapters: Record<number, AdapterMappings> = {
  //TODO fixme
  [Network.MAINNET]: { [SwapSide.BUY]: [{ name: 'Adapter01', index: 1 }] },
};
