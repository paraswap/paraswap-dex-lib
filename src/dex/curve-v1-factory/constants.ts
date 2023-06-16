import { Network } from '../../constants';

export const MIN_AMOUNT_TO_RECEIVE = 1;

export const STATE_UPDATE_PERIOD_MS = 5 * 1000;

export const LIQUIDITY_UPDATE_RETRY_PERIOD_MS = 1000;

export const LIQUIDITY_UPDATE_PERIOD_MS = 2 * 60 * 1000;

export const LIQUIDITY_ALLOWED_DELAY_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

export const POOL_EXCHANGE_GAS_COST = 200 * 1000;

// This is a liquidity threshold used for pool state update
export const MIN_LIQUIDITY_IN_USD = 50;

export const IS_LIQUIDITY_TRACKED = true;

export const LIQUIDITY_FETCH_TIMEOUT_MS = 2_000;

export const CONVERGENCE_ERROR_PREFIX = 'didnt_converge';

// Pooltracker relevant variables
export const CURVE_API_URL = 'https://api.curve.fi/api/getPools';
export const NETWORK_ID_TO_NAME: Record<number, string> = {
  [Network.MAINNET]: 'ethereum',
  [Network.POLYGON]: 'polygon',
  [Network.FANTOM]: 'fantom',
  [Network.AVALANCHE]: 'avalanche',
  [Network.ARBITRUM]: 'arbitrum',
  [Network.OPTIMISM]: 'optimism',
};

// They are hardcoded in factory contract. If factory is changing, must be
// revisited
export const FACTORY_MAX_PLAIN_COINS = 4;
export const FACTORY_MAX_PLAIN_IMPLEMENTATIONS_FOR_COIN = 10;

export const DIRECT_METHOD_NAME = 'directCurveV1Swap';
