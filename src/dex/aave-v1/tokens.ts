import { aToken, Token } from '../../types';
import { Network } from '../../constants';

import tokensMainnet from './tokens-mainnet.json';

const Tokens: { [network: number]: { [symbol: string]: aToken } } = {};
const TokensByAddress: { [network: number]: { [address: string]: aToken } } =
  {};

const tokensByNetwork: { [network: number]: any } = {
  [Network.MAINNET]: tokensMainnet,
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

// return null if pair does not exists otherwise return the aToken
export function isAAVEPair(
  network: number,
  src: Token,
  dst: Token,
): Token | null {
  const srcAddr = src.address.toLowerCase();
  const dstAddr = dst.address.toLowerCase();

  const _src = TokensByAddress[network][srcAddr];
  const _dst = TokensByAddress[network][dstAddr];

  if (_src && _src.address == dstAddr) {
    return src;
  }

  if (_dst && _dst.address == srcAddr) {
    return dst;
  }

  return null;
}

export function aaveV1GetToken(network: number, symbol: string): Token | null {
  const aToken = Tokens[network][symbol];
  if (!aToken) {
    return null;
  }

  return {
    address: aToken.aAddress,
    decimals: aToken.decimals,
    symbol: aToken.aSymbol,
  };
}
