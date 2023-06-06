import {
  DecodedCollateralStateLegacy,
  DecodedCollateralState,
  PoolState,
} from './types';
import { BigNumber } from 'ethers';
import { Address } from '@paraswap/core';

export const NULL_STATE: PoolState = {
  collaterals: {},
};

export const BOB_VAULT_GAS_COST = {
  buy: 110_000,
  sell: 270_000,
  swap: 290_000,
};

export const defaultValues: Record<string, BigNumber | Address> = {
  balance: BigNumber.from(0),
  buffer: BigNumber.from(0),
  dust: BigNumber.from(0),
  yield: '',
  price: BigNumber.from(0),
  inFee: BigNumber.from(0),
  outFee: BigNumber.from(0),
  maxBalance: BigNumber.from(0),
  maxInvested: BigNumber.from(0),
};

export const DENOMINATOR: bigint = 10n ** 18n;

export const MAX_FEE: bigint = 10n ** 16n;
