import { Token } from '../../types';
import { Network } from '../../constants';

import tokensMainnet from './tokens-mainnet.json';
import tokensPolygon from './tokens-polygon.json';
import tokensAvalanche from './tokens-avalanche.json';

export const Tokens: { [network: number]: { [symbol: string]: Token } } = {}

const tokensByNetwork: { [network: number]: any } = {
  [Network.MAINNET]: tokensMainnet,
  [Network.POLYGON]: tokensPolygon,
  [Network.AVALANCHE]: tokensAvalanche
}

for (const [key, tokens] of Object.entries(tokensByNetwork)) {
  Tokens[+key] = {};
  for (const token of tokens) {
    Tokens[+key][token.symbol] = token;
  }
}
