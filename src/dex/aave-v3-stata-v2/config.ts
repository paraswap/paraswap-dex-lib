import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import {
  AaveV3Ethereum,
  AaveV3EthereumLido,
  AaveV3Gnosis,
} from '@bgd-labs/aave-address-book';

export const AaveV3StataConfig: DexConfigMap<DexParams> = {
  AaveV3StataV2: {
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
