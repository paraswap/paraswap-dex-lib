import { aToken, Token } from '../../types';
import { Network } from '../../constants';

import tokensFantom from './tokens/fantom.json';
import tokensPolygon from './tokens/polygon.json';
import tokensAvalanche from './tokens/avalanche.json';
import tokensArbitrum from './tokens/arbitrum.json';
import tokensOptimism from './tokens/optimism.json';

export const Tokens: { [network: number]: { [symbol: string]: aToken } } = {};

type AaveToken = {
  aSymbol: string;
  aAddress: string;
  address: string;
  decimals: number;
};

const TokensByAddress: { [network: number]: { [address: string]: aToken } } =
  {};

// TODO(skypper): Remove useless utility functions.
const tokensByNetwork: { [network: number]: any } = {
  [Network.FANTOM]: tokensFantom,
  [Network.POLYGON]: [],
  // Disabled for testing.
  // [Network.POLYGON]: tokensPolygon,
  [Network.AVALANCHE]: tokensAvalanche,
  [Network.ARBITRUM]: tokensArbitrum,
  [Network.OPTIMISM]: tokensOptimism,
};

for (const [key, tokens] of Object.entries(tokensByNetwork)) {
  const network = +key;
  Tokens[network] = {};
  TokensByAddress[network] = {};
  for (const token of tokens) {
    Tokens[network][token.aSymbol] = token;
    TokensByAddress[network][token.aAddress.toLowerCase()] = token;
  }
}

// return null if the pair does not exists otherwise return the aToken
export function getATokenIfAaveV3Pair(
  network: number,
  src: Token,
  dst: Token,
): Token | null {
  const srcAddr = src.address.toLowerCase();
  const dstAddr = dst.address.toLowerCase();

  const _src = TokensByAddress[network][srcAddr];
  const _dst = TokensByAddress[network][dstAddr];

  // supposing _src / _dst .address is lowercase

  if (_src && _src.address == dstAddr) {
    return src;
  }

  if (_dst && _dst.address == srcAddr) {
    return dst;
  }

  return null;
}

export function getTokenFromASymbol(
  network: number,
  symbol: string,
): Token | null {
  const aToken = Tokens[network][symbol];

  if (!aToken) return null;

  return {
    address: aToken.aAddress,
    decimals: aToken.decimals,
    symbol: aToken.aSymbol,
  };
}

export function setTokensOnNetwork(network: Network, tokens: AaveToken[]) {
  for (const token of tokens) {
    TokensByAddress[network][token.aAddress.toLowerCase()] = token;
    TokensByAddress[network][token.address.toLowerCase()] = token;
  }
}
