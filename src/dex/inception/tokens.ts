import { Network } from '../../constants';
import { DexParams } from './types';

export const Tokens: { [network: number]: { [symbol: string]: DexParams } } =
  {};

const TokensByAddress: {
  [network: number]: { [address: string]: DexParams };
} = {};

export function setTokensOnNetwork(network: Network, tokens: DexParams[]) {
  if (Tokens[network] === undefined) {
    Tokens[network] = {};
  }

  if (TokensByAddress[network] === undefined) {
    TokensByAddress[network] = {};
  }

  for (let token of tokens) {
    token.vault = token.vault.toLowerCase();
    token.token = token.token.toLowerCase();
    token.baseToken = token.baseToken.toLowerCase();

    Tokens[network][token.symbol] = token;
    TokensByAddress[network][token.vault] = token;
    TokensByAddress[network][token.token] = token;
    TokensByAddress[network][token.baseToken] = token;
  }
}

export function getTokenFromAddress(
  network: Network,
  address: string,
): DexParams {
  return TokensByAddress[network]?.[address.toLowerCase()];
}
