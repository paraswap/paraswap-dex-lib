import { WusdmParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const WUSDMConfig: DexConfigMap<WusdmParams> = {
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
  // not really wUSDM, but works in the same way
  // might give 1wei difference on BUY
  sDAI: {
    [Network.GNOSIS]: {
      wUSDMAddress: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // sDAI
      USDMAddress: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // WXDAI
    },
  },

  wUSDL: {
    [Network.MAINNET]: {
      wUSDMAddress: '0x7751E2F4b8ae93EF6B79d86419d42FE3295A4559', // wUSDL
      USDMAddress: '0xbdC7c08592Ee4aa51D06C27Ee23D5087D65aDbcD', // USDL
    },
  },
};
