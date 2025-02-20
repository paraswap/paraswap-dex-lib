/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { MToken } from './m-token';
import { MWrappedM } from './m-wrapped-m';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

async function testPricingOnNetwork(
  mWrappedM: MToken,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
  funcNameToCheck: string,
) {
  const networkTokens = Tokens[network];

  const pools = await mWrappedM.getPoolIdentifiers(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    side,
    blockNumber,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Identifiers: `,
    pools,
  );

  expect(pools.length).toBeGreaterThan(0);

  const poolPrices = await mWrappedM.getPricesVolume(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    amounts,
    side,
    blockNumber,
    pools,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Prices: `,
    poolPrices,
  );

  expect(poolPrices).not.toBeNull();
  if (mWrappedM.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  checkPoolPrices(poolPrices!, amounts, side, dexKey);
}

describe('MWrappedM', function () {
  const dexKey = 'MWrappedM';
  let blockNumber: number;
  let mWrappedM: MWrappedM;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'M';
    const destTokenSymbol = 'WrappedM';

    // Don't forget to update relevant tokens in constant-e2e.ts

    const amounts = [
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
      mWrappedM = new MWrappedM(network, dexKey, dexHelper);
      if (mWrappedM.initializePricing) {
        await mWrappedM.initializePricing();
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL M -> WrappedM', async function () {
      await testPricingOnNetwork(
        mWrappedM,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amounts,
        '',
      );
    });

    it('getPoolIdentifiers and getPricesVolume SELL WrappedM -> M', async function () {
      await testPricingOnNetwork(
        mWrappedM,
        network,
        dexKey,
        blockNumber,
        destTokenSymbol,
        srcTokenSymbol,
        SwapSide.SELL,
        amounts,
        '',
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY M -> WrappedM', async function () {
      await testPricingOnNetwork(
        mWrappedM,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.BUY,
        amounts,
        '',
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY WrappedM -> M', async function () {
      await testPricingOnNetwork(
        mWrappedM,
        network,
        dexKey,
        blockNumber,
        destTokenSymbol,
        srcTokenSymbol,
        SwapSide.BUY,
        amounts,
        '',
      );
    });

    it('getTopPoolsForToken: M', async function () {
      const symbol = srcTokenSymbol;

      const poolLiquidity = await mWrappedM.getTopPoolsForToken(
        tokens[symbol].address,
        10,
      );
      console.log(
        `${symbol} Top Pools:`,
        JSON.stringify(poolLiquidity, null, 2),
      );

      checkPoolsLiquidity(
        poolLiquidity,
        Tokens[network][symbol].address,
        dexKey,
      );
    });

    it('getTopPoolsForToken: WrappedM', async function () {
      const symbol = destTokenSymbol;

      const poolLiquidity = await mWrappedM.getTopPoolsForToken(
        tokens[symbol].address,
        10,
      );
      console.log(
        `${symbol} Top Pools:`,
        JSON.stringify(poolLiquidity, null, 2),
      );

      checkPoolsLiquidity(
        poolLiquidity,
        Tokens[network][symbol].address,
        dexKey,
      );
    });
  });
});
