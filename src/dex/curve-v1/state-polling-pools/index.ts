import { ImplementationNames } from '../types';
import { BasePoolPolling } from './base-pool-polling';
import { CustomBasePoolForFactory } from './custom-pool-polling';
import { FactoryStateHandler } from './factory-pool-polling';

const implementations: Record<ImplementationNames, BasePoolPolling> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: CustomBasePoolForFactory,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_BTC]: CustomBasePoolForFactory,
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: CustomBasePoolForFactory,

  [ImplementationNames.FACTORY_META_3POOL_2_8]: FactoryStateHandler,
  [ImplementationNames.FACTORY_META_3POOL_2_15]: FactoryStateHandler,

  [ImplementationNames.FACTORY_META_FRAX]: FactoryStateHandler,
  [ImplementationNames.FACTORY_META_3POOL_FEE_TRANSFER]: FactoryStateHandler,
  [ImplementationNames.FACTORY_META_BTC]: FactoryStateHandler,

  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: FactoryStateHandler,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_18DEC]: FactoryStateHandler,
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_FEE_TRANSFER]:
    FactoryStateHandler,
  [ImplementationNames.FACTORY_PLAIN_2COIN_NATIVE]: FactoryStateHandler,

  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20]: FactoryStateHandler,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_18DEC]: FactoryStateHandler,
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_FEE_TRANSFER]:
    FactoryStateHandler,

  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20]: FactoryStateHandler,
  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20_18DEC]: FactoryStateHandler,
};
