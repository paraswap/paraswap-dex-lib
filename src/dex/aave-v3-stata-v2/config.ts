import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';
import {
  AaveV3Ethereum,
  AaveV3EthereumLido,
  AaveV3Gnosis,
} from '@bgd-labs/aave-address-book';

export const AaveV3StataConfig: DexConfigMap<DexParams> = {
  AaveV3Stata: {
    [Network.MAINNET]: {
      factoryAddresses: [
        AaveV3Ethereum.STATA_FACTORY,
        AaveV3EthereumLido.STATA_FACTORY,
      ],
      pool: AaveV3Ethereum.POOL,
    },
    [Network.GNOSIS]: {
      factoryAddresses: [AaveV3Gnosis.STATA_FACTORY],
      pool: AaveV3Gnosis.POOL,
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {
  // TODO: add adapters for each chain for V5 support
  [Network.MAINNET]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
  [Network.GNOSIS]: { [SwapSide.SELL]: [{ name: '', index: 0 }] },
};
