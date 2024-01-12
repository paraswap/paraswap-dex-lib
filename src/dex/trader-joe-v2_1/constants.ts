export const TRADER_JOE_V2_CHUNKS = 10;
export const TRADER_JOE_V2_QUOTE_GASLIMIT = 200_000;

export const EMPTY_POOL_CACHE_TTL = 60 * 60;
export const POPULATED_POOL_CACHE_TTL = 12 * 60 * 60;

export const BASIS_POINT_MAX = 10_000n;
export const SCALE_OFFSET = 128n;
export const PRECISION = BigInt(1e18);
export const CACHE_PREFIX = 'dl';

export const MinLBPairAbi = [
  {
    inputs: [],
    name: 'getTokenX',
    outputs: [{ internalType: 'contract IERC20', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

export const SUPPORTED_BIN_STEPS = [1n, 2n, 5n, 10n, 15n, 20n, 25n, 50n, 100n];
