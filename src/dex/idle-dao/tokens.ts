import { Token } from '../../types';
import { Network } from '../../constants';

import { IdleToken } from './types';

export const Tokens: { [network: number]: { [symbol: string]: IdleToken } } =
  {};

const TokensByAddress: { [network: number]: { [address: string]: IdleToken } } =
  {};

// return null if the pair does not exists otherwise return the idleToken
export function getIdleTokenIfIdleDaoPair(
  network: number,
  src: Token,
  dst: Token,
): IdleToken | null {
  const srcAddr = src.address.toLowerCase();
  const dstAddr = dst.address.toLowerCase();

  if (srcAddr === dstAddr) {
    return null;
  }

  const _src = TokensByAddress[network][srcAddr];
  const _dst = TokensByAddress[network][dstAddr];

  if (_src && _src.address.toLowerCase() == dstAddr) {
    return _src;
  }

  if (_dst && _dst.address.toLowerCase() == srcAddr) {
    return _dst;
  }

  return null;
}

export function getTokenFromIdleSymbol(
  network: number,
  symbol: string,
): Token | null {
  const idleToken = Tokens[network][symbol];

  if (!idleToken) return null;

  return {
    address: idleToken.idleAddress,
    decimals: idleToken.decimals,
    symbol: idleToken.idleSymbol,
  };
}

export function setTokensOnNetwork(network: Network, tokens: IdleToken[]) {
  for (let token of tokens) {
    token.address = token.address.toLowerCase();
    token.idleAddress = token.idleAddress.toLowerCase();

    if (Tokens[network] === undefined) {
      Tokens[network] = {};
    }
    if (TokensByAddress[network] === undefined) {
      TokensByAddress[network] = {};
    }
    Tokens[network][token.idleSymbol] = token;
    TokensByAddress[network][token.idleAddress] = token;
    TokensByAddress[network][token.address] = token;
  }
}
