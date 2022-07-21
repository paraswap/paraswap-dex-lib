export const ONE_ORDER_GASCOST = 65500;

// In one swap we can use only MAX_ORDERS_COUNT_FOR_SWAP for pricing and tx building
// TODO: Must be replaced later with configuration service
export const MAX_ORDERS_USED_FOR_SWAP = BigInt(
  process.env.MAX_ORDERS_USED_FOR_SWAP || '3',
);

// When we try to filter small orders, we have this multiplication factor which is used
// (amount / (MAX_ORDERS_USED_FOR_SWAP * MAX_ORDERS_MULTI_FACTOR)) > takerBalance
// TODO: Must be replaced later with configuration service
export const MAX_ORDERS_MULTI_FACTOR = BigInt(
  process.env.MAX_ORDERS_MULTI_FACTOR || '2',
);
