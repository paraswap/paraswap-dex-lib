import { EncodedOrder, TokenPair } from '../common/types';

// Compare tokens using the default locale
const compareTokens = (token0: string, token1: string): number =>
  token0.localeCompare(token1);

const SEPARATOR = '->-<-';

// Convert two tokens to a string key
const toKey = (tokens: string[]): string => {
  // Check if the array has exactly two elements
  if (tokens.length !== 2) {
    throw new Error(
      `Invalid number of tokens: expected 2, got ${tokens.length}`,
    );
  }

  // Check if tokens are the same, and throw an error if they are
  if (tokens[0] === tokens[1]) {
    throw new Error(`Cannot create key for identical tokens: ${tokens[0]}`);
  }

  return tokens.join(SEPARATOR);
};

// Convert two tokens to a string key
export const toPairKey = (token0: string, token1: string): string => {
  // Sort tokens and turn to key
  return toKey([token0, token1].sort(compareTokens));
};

export const fromPairKey = (key: string): TokenPair => {
  const tokens = key.split(SEPARATOR);
  return [tokens[0], tokens[1]];
};

// Convert two tokens to a string key, order matters
export const toDirectionKey = (token0: string, token1: string): string => {
  return toKey([token0, token1]);
};

// find and return an element in an array, and remove it and all elements before it. If not found, remove all elements.
export const findAndRemoveLeading = <T>(
  arr: T[],
  predicate: (value: T) => boolean,
): T | undefined => {
  let element = undefined;
  do {
    element = arr.shift();
  } while (element && !predicate(element));
  return element;
};

export function isOrderTradable(order: EncodedOrder): boolean {
  return order.y.gt(0) && (order.A.gt(0) || order.B.gt(0));
}
