import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { AaveV3Ethereum, GhoEthereum } from '@bgd-labs/aave-address-book';

export const AaveGsmConfig: DexConfigMap<DexParams> = {
  AaveGsm: {
    [Network.MAINNET]: {
      GSM_USDT: GhoEthereum.GSM_USDT,
      GSM_USDC: GhoEthereum.GSM_USDC,
      USDT: AaveV3Ethereum.ASSETS.USDT.UNDERLYING,
      USDC: AaveV3Ethereum.ASSETS.USDC.UNDERLYING,
      GHO: AaveV3Ethereum.ASSETS.GHO.UNDERLYING,
    },
  },
};
