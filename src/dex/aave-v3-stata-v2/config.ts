import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import {
  AaveV3Arbitrum,
  AaveV3Base,
  AaveV3Ethereum,
  AaveV3EthereumLido,
  AaveV3Gnosis,
  AaveV3Optimism,
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
    // Waiting for BalancerV3 to get released on Optimism
    // [Network.OPTIMISM]: {
    //   factoryAddresses: [AaveV3Optimism.STATA_FACTORY],
    //   pool: AaveV3Optimism.POOL,
    // },
    [Network.ARBITRUM]: {
      factoryAddresses: [AaveV3Arbitrum.STATA_FACTORY],
      pool: AaveV3Arbitrum.POOL,
    },
    [Network.BASE]: {
      factoryAddresses: [AaveV3Base.STATA_FACTORY],
      pool: AaveV3Base.POOL,
    },
  },
};
