import { MAX_ORDERS_MULTI_FACTOR, MAX_ORDERS_USED_FOR_SWAP } from './constant';

export const calcAmountThreshold = (amount: bigint) =>
  amount / (MAX_ORDERS_USED_FOR_SWAP * MAX_ORDERS_MULTI_FACTOR);
