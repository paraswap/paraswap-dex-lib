import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

export const WUSDMConfig: DexConfigMap<DexParams> = {
  wUSDM: {
    [Network.MAINNET]: {
      wUSDMAddress: '0x57F5E098CaD7A3D1Eed53991D4d66C45C9AF7812',
      USDMAddress: '0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C',
    },
    [Network.OPTIMISM]: {
      wUSDMAddress: '0x57F5E098CaD7A3D1Eed53991D4d66C45C9AF7812',
      USDMAddress: '0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C',
    },
    [Network.ARBITRUM]: {
      wUSDMAddress: '0x57F5E098CaD7A3D1Eed53991D4d66C45C9AF7812',
      USDMAddress: '0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C',
    },
    [Network.BASE]: {
      wUSDMAddress: '0x57F5E098CaD7A3D1Eed53991D4d66C45C9AF7812',
      USDMAddress: '0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C',
    },
    [Network.POLYGON]: {
      wUSDMAddress: '0x57F5E098CaD7A3D1Eed53991D4d66C45C9AF7812',
      USDMAddress: '0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C',
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
