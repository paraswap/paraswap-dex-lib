import { ImplementationNames, PoolConstants } from '../types';

const implementationConstants: Record<ImplementationNames, PoolConstants> = {
  [ImplementationNames.BASE_THREE_POOL]: {},
  [ImplementationNames.BASE_BTC_POOL]: {},
  [ImplementationNames.BASE_FRAX_POOL]: {},

  [ImplementationNames.FACTORY_META_3POOL_2_15]: {},
  [ImplementationNames.FACTORY_META_3POOL_2_8]: {},
  [ImplementationNames.FACTORY_META_3POOL_3_1]: {},
  [ImplementationNames.FACTORY_META_3POOL_ERC20_FEE_TRANSFER]: {},
  [ImplementationNames.FACTORY_META_SBTC_ERC20]: {},

  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]: {},
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_18DEC]: {},
  [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_FEE_TRANSFER]: {},
  [ImplementationNames.FACTORY_PLAIN_2COIN_NATIVE]: {},
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20]: {},
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_18DEC]: {},
  [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_FEE_TRANSFER]: {},
  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20]: {},
  [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20_18DEC]: {},
};

export default implementationConstants;
