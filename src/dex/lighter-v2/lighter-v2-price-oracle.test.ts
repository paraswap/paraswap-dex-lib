/* eslint-disable no-console */
import dotenv from 'dotenv';

dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { LighterPriceOracle } from './price-oracle';
import { LighterV2 } from './lighter-v2';
import { LighterV2Config } from './config';

describe('LighterV2 Price Oracle', function () {
  const networks = Object.keys(LighterV2Config.LighterV2);

  // for each network, create `lighterV2` and `initializePricing`
  // lighterV2 should initialize all the tokens which are used in at least one pair
  // the test checks that price oracle returns a valid price for all tokens
  networks.forEach(networkStr => {
    const network = parseInt(networkStr);
    it(network.toString(), async () => {
      const dexKey = 'LighterV2';
      const dexHelper = new DummyDexHelper(network);
      const priceOracle = new LighterPriceOracle(dexHelper.httpRequest);
      const lighterV2 = new LighterV2(network, dexKey, dexHelper);

      const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      await lighterV2.initializePricing(blockNumber);
      const tokens = [...lighterV2.tokens.values()];

      for (const token of tokens) {
        const price = await priceOracle.getTokenPrice(token.symbol);
        console.log(
          `${network.toString()} fetched price ${price} for ${token.symbol} ${
            token.address
          }`,
        );
        expect(price).toBeGreaterThan(0);
      }
    });
  });
});
