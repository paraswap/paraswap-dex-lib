import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { JarvisV6 } from './jarvis-v6';
import { checkPoolPrices } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

/*
  README
  ======

  This test script adds tests for JarvisV6 general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover JarvisV6 specific
  logic.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-integration.test.ts`

  (This comment should be removed from the final implementation)
*/

const network = Network.POLYGON;
const TokenASymbol = 'jEUR';
const TokenA = Tokens[network][TokenASymbol];
const TokenAAmounts = [0n, BI_POWS[18], 2000000000000000000n];

const TokenBSymbol = 'USDC';
const TokenB = Tokens[network][TokenBSymbol];
const TokenBAmounts = [0n, BI_POWS[6], 2000000n];

const dexHelper = new DummyDexHelper(network);
const dexKey = 'JarvisV6';

describe('JarvisV6', function () {
  let blockNumber: number;
  let jarvisV6: JarvisV6;

  beforeAll(async () => {
    blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    jarvisV6 = new JarvisV6(network, dexKey, dexHelper);
    await jarvisV6.initializePricing(blockNumber);
  });
  describe('Redeem() Swap Function', () => {
    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      const pools = await jarvisV6.getPoolIdentifiers(
        TokenA,
        TokenB,
        SwapSide.SELL,
        blockNumber,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await jarvisV6.getPricesVolume(
        TokenA,
        TokenB,
        TokenAAmounts,
        SwapSide.SELL,
        blockNumber,
        pools,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, TokenAAmounts, SwapSide.SELL, dexKey);
    });
  });
  describe('Mint() Swap Function', () => {
    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      const pools = await jarvisV6.getPoolIdentifiers(
        TokenB,
        TokenA,
        SwapSide.SELL,
        blockNumber,
      );
      console.log(
        `${TokenBSymbol} <> ${TokenASymbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await jarvisV6.getPricesVolume(
        TokenB,
        TokenA,
        TokenBAmounts,
        SwapSide.SELL,
        blockNumber,
        pools,
      );
      console.log(
        `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, TokenBAmounts, SwapSide.SELL, dexKey);
    });
  });
});
