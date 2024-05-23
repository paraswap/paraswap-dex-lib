import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { JarvisV6 } from './jarvis-v6';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
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

const TokenCSymbol = 'jCHF';
const TokenC = Tokens[network][TokenCSymbol];
const TokenCAmounts = [0n, BI_POWS[18], 2000000000000000000n];

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
  describe('Exchange() Swap Function', () => {
    describe(`${TokenASymbol} -> ${TokenCSymbol} swap`, function () {
      it('getPoolIdentifiers and getPricesVolume SELL', async function () {
        const pools = await jarvisV6.getPoolIdentifiers(
          TokenA,
          TokenC,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenCSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await jarvisV6.getPricesVolume(
          TokenA,
          TokenC,
          TokenAAmounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );
        console.log(
          `${TokenASymbol} <> ${TokenCSymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();
        checkPoolPrices(poolPrices!, TokenAAmounts, SwapSide.SELL, dexKey);
      });
    });
    describe(`${TokenCSymbol} -> ${TokenASymbol} swap`, function () {
      it('getPoolIdentifiers and getPricesVolume SELL', async function () {
        const pools = await jarvisV6.getPoolIdentifiers(
          TokenC,
          TokenA,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenCSymbol} <> ${TokenASymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await jarvisV6.getPricesVolume(
          TokenC,
          TokenA,
          TokenCAmounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );
        console.log(
          `${TokenCSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();
        checkPoolPrices(poolPrices!, TokenCAmounts, SwapSide.SELL, dexKey);
      });
    });
    describe('getTopPoolsForToken()', function () {
      it(`${TokenASymbol}`, async function () {
        const poolLiquidity = await jarvisV6.getTopPoolsForToken(
          TokenA.address,
          10,
        );
        console.log(
          `${TokenASymbol} Top Pools:`,
          JSON.stringify(poolLiquidity, null, 2),
        );

        checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
      });
    });
  });
});
