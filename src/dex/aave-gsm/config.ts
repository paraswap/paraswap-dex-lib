import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import { AaveV3Ethereum, MiscEthereum } from '@bgd-labs/aave-address-book';

export const AaveGsmConfig: DexConfigMap<DexParams> = {
  AaveGsm: {
    [Network.MAINNET]: {
      GSM_USDT: MiscEthereum.GSM_USDT,
      GSM_USDC: MiscEthereum.GSM_USDC,
      USDT: AaveV3Ethereum.ASSETS.USDT.UNDERLYING,
      USDC: AaveV3Ethereum.ASSETS.USDC.UNDERLYING,
      GHO: AaveV3Ethereum.ASSETS.GHO.UNDERLYING,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain
  // This is an example to copy
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
