export const TRADER_JOE_V2_CHUNKS = 10;
export const TRADER_JOE_V2_QUOTE_GASLIMIT = 200_000;

export const EMPTY_POOL_CACHE_TTL = 60 * 60;
export const POPULATED_POOL_CACHE_TTL = 12 * 60 * 60;

export const MinLBPairAbi = [
  {
    inputs: [],
    name: 'getTokenX',
    outputs: [{ internalType: 'contract IERC20', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];
