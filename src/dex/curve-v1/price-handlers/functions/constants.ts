import {} from 'ts-essentials';
import { BI_POWS } from '../../../../bigint-constants';
import { ImplementationNames, PoolContextConstants } from '../../types';

// [ImplementationNames.BASE_THREE_POOL]:
// [ImplementationNames.BASE_FRAX_POOL]:
// [ImplementationNames.FACTORY_META_3POOL_2_15]:
// [ImplementationNames.FACTORY_META_3POOL_2_8]:
// [ImplementationNames.FACTORY_META_3POOL_3_1]:
// [ImplementationNames.FACTORY_META_3POOL_ERC20_FEE_TRANSFER]:
// [ImplementationNames.FACTORY_META_SBTC_ERC20]:
// [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20]:
// [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_18DEC]:
// [ImplementationNames.FACTORY_PLAIN_2COIN_ERC20_FEE_TRANSFER]:
// [ImplementationNames.FACTORY_PLAIN_2COIN_NATIVE]:
// [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20]:
// [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_18DEC]:
// [ImplementationNames.FACTORY_PLAIN_3COIN_ERC20_FEE_TRANSFER]:
// [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20]:
// [ImplementationNames.FACTORY_PLAIN_4COIN_ERC20_18DEC]:

const implementationConstants: Record<
  ImplementationNames,
  PoolContextConstants
> = {
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: {
    N_COINS: 3,
    BI_N_COINS: 3n,

    FEE_DENOMINATOR: BI_POWS[10],
    LENDING_PRECISION: BI_POWS[18],
    PRECISION: BI_POWS[18],
    PRECISION_MUL: [1n, 1000000000000n, 1000000000000n],
    // Just copied from original implementation
    RATES: [
      1000000000000000000n,
      1000000000000000000000000000000n,
      1000000000000000000000000000000n,
    ],
  },
  [ImplementationNames.CUSTOM_PLAIN_3COIN_BTC]: {
    N_COINS: 3,
    BI_N_COINS: 3n,

    USE_LENDING: [true, false, false],

    FEE_DENOMINATOR: BI_POWS[10],
    LENDING_PRECISION: BI_POWS[18],
    PRECISION: BI_POWS[18],
    PRECISION_MUL: [10000000000n, 10000000000n, 1n],
  },
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: {
    N_COINS: 2,
    BI_N_COINS: 2n,
    PRECISION_MUL: [1n, 1000000000000n],
    RATES: [1000000000000000000n, 1000000000000000000000000000000n],

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],
    A_PRECISION: 100n,
  },

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
