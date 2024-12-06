/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Stader } from './stader';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

describe('Stader', function () {
  const dexKey = 'Stader';
  let blockNumber: number;
  let stader: Stader;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // TODO: Put here token Symbol to check against
    // Don't forget to update relevant tokens in constant-e2e.ts
    const srcTokenSymbol = 'ETH';
    const destTokenSymbol = 'ETHx';

    const amountsForSell = [
      0n,
      1n * BI_POWS[tokens[srcTokenSymbol].decimals],
      2n * BI_POWS[tokens[srcTokenSymbol].decimals],
      3n * BI_POWS[tokens[srcTokenSymbol].decimals],
      4n * BI_POWS[tokens[srcTokenSymbol].decimals],
      5n * BI_POWS[tokens[srcTokenSymbol].decimals],
      6n * BI_POWS[tokens[srcTokenSymbol].decimals],
      7n * BI_POWS[tokens[srcTokenSymbol].decimals],
      8n * BI_POWS[tokens[srcTokenSymbol].decimals],
      9n * BI_POWS[tokens[srcTokenSymbol].decimals],
      10n * BI_POWS[tokens[srcTokenSymbol].decimals],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      stader = new Stader(network, dexKey, dexHelper);
      if (stader.initializePricing) {
        await stader.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume ETH -> ETHx SELL', async function () {
      const pools = await stader.getPoolIdentifiers(
        tokens[srcTokenSymbol],
        tokens[destTokenSymbol],
        SwapSide.SELL,
        blockNumber,
      );
      console.log(
        `${srcTokenSymbol} <> ${destTokenSymbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await stader.getPricesVolume(
        tokens[srcTokenSymbol],
        tokens[destTokenSymbol],
        amountsForSell,
        SwapSide.SELL,
        blockNumber,
        pools,
      );
      console.log(
        `${srcTokenSymbol} <> ${destTokenSymbol} Pool Prices: `,
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amountsForSell, SwapSide.SELL, dexKey);
    });
  });
});
