import {} from 'ts-essentials';
import { BI_POWS } from '../../../../bigint-constants';
import { ImplementationNames, PoolContextConstants } from '../../types';

const implementationConstants: Record<
  ImplementationNames,
  PoolContextConstants
> = {
  [ImplementationNames.CUSTOM_PLAIN_2COIN_FRAX]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,
    PRECISION_MUL: [1n, 1000000000000n],
    RATES: [1000000000000000000n, 1000000000000000000000000000000n],

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],
    A_PRECISION: 100n,
  },
  [ImplementationNames.CUSTOM_PLAIN_2COIN_RENBTC]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    PRECISION_MUL: [10000000000n, 10000000000n],
    LENDING_PRECISION: BI_POWS[18],
    USE_LENDING: [true, false],
  },
  [ImplementationNames.CUSTOM_PLAIN_3COIN_SBTC]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 3,
    BI_N_COINS: 3n,

    USE_LENDING: [true, false, false],

    FEE_DENOMINATOR: BI_POWS[10],
    LENDING_PRECISION: BI_POWS[18],
    PRECISION: BI_POWS[18],
    PRECISION_MUL: [10000000000n, 10000000000n, 1n],
  },
  [ImplementationNames.CUSTOM_PLAIN_3COIN_THREE]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 3,
    BI_N_COINS: 3n,

    FEE_DENOMINATOR: BI_POWS[10],
    LENDING_PRECISION: BI_POWS[18],
    PRECISION: BI_POWS[18],
    PRECISION_MUL: [1n, 1000000000000n, 1000000000000n],
    RATES: [
      1000000000000000000n,
      1000000000000000000000000000000n,
      1000000000000000000000000000000n,
    ],
  },
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_BTC]: {
    isFeeOnTransferSupported: false,
    isWrapNative: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.CUSTOM_ARBITRUM_2COIN_USD]: {
    isFeeOnTransferSupported: false,
    isWrapNative: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.CUSTOM_AVALANCHE_3COIN_LENDING]: {
    isFeeOnTransferSupported: false,
    isWrapNative: false,

    N_COINS: 3,
    BI_N_COINS: 3n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    PRECISION_MUL: [1n, 1000000000000n, 1000000000000n],
    A_PRECISION: 100n,
  },
  [ImplementationNames.CUSTOM_FANTOM_2COIN_BTC]: {
    isFeeOnTransferSupported: false,
    isWrapNative: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    PRECISION_MUL: [10000000000n, 10000000000n],
    A_PRECISION: 100n,
    RATES: [10000000000000000000000000000n, 10000000000000000000000000000n],
  },
  [ImplementationNames.CUSTOM_FANTOM_2COIN_USD]: {
    isFeeOnTransferSupported: false,
    isWrapNative: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    PRECISION_MUL: [1n, 1000000000000n],
    A_PRECISION: 100n,
    RATES: [1000000000000000000n, 1000000000000000000000000000000n],
  },
  [ImplementationNames.CUSTOM_FANTOM_3COIN_LENDING]: {
    isFeeOnTransferSupported: false,
    isWrapNative: false,

    N_COINS: 3,
    BI_N_COINS: 3n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    PRECISION_MUL: [1n, 1000000000000n, 1000000000000n],
    A_PRECISION: 100n,
  },
  [ImplementationNames.CUSTOM_OPTIMISM_3COIN_USD]: {
    isFeeOnTransferSupported: false,
    isWrapNative: false,

    N_COINS: 3,
    BI_N_COINS: 3n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.CUSTOM_POLYGON_2COIN_LENDING]: {
    isFeeOnTransferSupported: false,
    isWrapNative: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    PRECISION_MUL: [10000000000n, 10000000000n],
    A_PRECISION: 100n,
  },
  [ImplementationNames.CUSTOM_POLYGON_3COIN_LENDING]: {
    isFeeOnTransferSupported: false,
    isWrapNative: false,

    N_COINS: 3,
    BI_N_COINS: 3n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    PRECISION_MUL: [1n, 1000000000000n, 1000000000000n],
    A_PRECISION: 100n,
  },

  [ImplementationNames.FACTORY_V1_META_BTC]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
    MAX_COIN: 2 - 1,
    BASE_N_COINS: 3,
  },
  [ImplementationNames.FACTORY_V1_META_USD]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
    MAX_COIN: 2 - 1,
    BASE_N_COINS: 3,
  },
  [ImplementationNames.FACTORY_META_BTC]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
    MAX_COIN: 2 - 1,
    BASE_N_COINS: 3,
  },
  [ImplementationNames.FACTORY_META_BTC_BALANCES]: {
    isWrapNative: false,
    isFeeOnTransferSupported: true,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
    MAX_COIN: 2 - 1,
    BASE_N_COINS: 3,
  },
  [ImplementationNames.FACTORY_META_BTC_REN]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
    MAX_COIN: 2 - 1,
    BASE_N_COINS: 2,
  },
  [ImplementationNames.FACTORY_META_BTC_BALANCES_REN]: {
    isWrapNative: false,
    isFeeOnTransferSupported: true,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
    MAX_COIN: 2 - 1,
    BASE_N_COINS: 2,
  },
  [ImplementationNames.FACTORY_META_USD]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
    MAX_COIN: 2 - 1,
    BASE_N_COINS: 3,
  },
  [ImplementationNames.FACTORY_META_USD_BALANCES]: {
    isWrapNative: false,
    isFeeOnTransferSupported: true,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
    MAX_COIN: 2 - 1,
    BASE_N_COINS: 3,
  },
  [ImplementationNames.FACTORY_META_USD_FRAX_USDC]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
    MAX_COIN: 2 - 1,
    BASE_N_COINS: 2,
  },
  [ImplementationNames.FACTORY_META_USD_BALANCES_FRAX_USDC]: {
    isWrapNative: false,
    isFeeOnTransferSupported: true,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
    MAX_COIN: 2 - 1,
    BASE_N_COINS: 2,
  },

  [ImplementationNames.FACTORY_PLAIN_2_BALANCES]: {
    isWrapNative: false,
    isFeeOnTransferSupported: true,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_2_BASIC]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_2_ETH]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_2_OPTIMIZED]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 2,
    BI_N_COINS: 2n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_3_BALANCES]: {
    isWrapNative: false,
    isFeeOnTransferSupported: true,

    N_COINS: 3,
    BI_N_COINS: 3n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_3_BASIC]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 3,
    BI_N_COINS: 3n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_3_ETH]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 3,
    BI_N_COINS: 3n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_3_OPTIMIZED]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 3,
    BI_N_COINS: 3n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_4_BALANCES]: {
    isWrapNative: false,
    isFeeOnTransferSupported: true,

    N_COINS: 4,
    BI_N_COINS: 4n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_4_BASIC]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 4,
    BI_N_COINS: 4n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_4_ETH]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 4,
    BI_N_COINS: 4n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
  [ImplementationNames.FACTORY_PLAIN_4_OPTIMIZED]: {
    isWrapNative: false,
    isFeeOnTransferSupported: false,

    N_COINS: 4,
    BI_N_COINS: 4n,

    FEE_DENOMINATOR: BI_POWS[10],
    PRECISION: BI_POWS[18],

    A_PRECISION: 100n,
  },
};

export default implementationConstants;
