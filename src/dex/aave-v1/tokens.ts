import { Token } from '../../types';
import { Network } from '../../constants';

import tokensMainnet from './tokens-mainnet.json';

export const Tokens: { [network: number]: { [symbol: string]: Token } } = {};

const tokensByNetwork: { [network: number]: any } = {
  [Network.MAINNET]: tokensMainnet,
};

for (const [key, tokens] of Object.entries(tokensByNetwork)) {
  Tokens[+key] = {};
  for (const token of tokens) {
    Tokens[+key][token.symbol] = token;
  }
}
