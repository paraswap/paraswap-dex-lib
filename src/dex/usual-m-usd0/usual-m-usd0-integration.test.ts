/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { UsualMUsd0 } from './usual-m-usd0';
import {
  checkPoolPrices,
  checkConstantPoolPrices,
  checkPoolsLiquidity,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

async function testPricingOnNetwork(
  usualMSmartM: UsualMUsd0,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenAddress: string,
  destTokenAddress: string,
  side: SwapSide,
  amounts: bigint[],
  funcNameToCheck: string,
) {
  const networkTokens = Tokens[network];

  console.log(amounts);

  const pools = await usualMSmartM.getPoolIdentifiers(
    networkTokens['UsualM'],
    networkTokens['USD0'],
    side,
    blockNumber,
  );
  console.log(`${'UsualM'} <> ${'USD0'} Pool Identifiers: `, pools);

  expect(pools.length).toBeGreaterThan(0);

  const poolPrices = await usualMSmartM.getPricesVolume(
    networkTokens['UsualM'],
    networkTokens['USD0'],
    amounts,
    side,
    blockNumber,
    pools,
  );
  console.log(`${'UsualM'} <> ${'USD0'} Pool Prices: `, poolPrices);

  expect(poolPrices).not.toBeNull();
  if (usualMSmartM.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  checkPoolPrices(poolPrices!, amounts, side, dexKey);
}

describe('UsualM<>USD0', function () {
  const dexKey = 'UsualMUSD0';
  let blockNumber: number;
  let usualMUsd0: UsualMUsd0;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    // Don't forget to update relevant tokens in constant-e2e.ts

    const amountsForSell = [
      0n,
      1n * BI_POWS[18],
      2n * BI_POWS[18],
      3n * BI_POWS[18],
      4n * BI_POWS[18],
      5n * BI_POWS[18],
      6n * BI_POWS[18],
      7n * BI_POWS[18],
      8n * BI_POWS[18],
      9n * BI_POWS[18],
      10n * BI_POWS[18],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      usualMUsd0 = new UsualMUsd0(network, dexKey, dexHelper);
      if (usualMUsd0.initializePricing) {
        await usualMUsd0.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        usualMUsd0,
        network,
        dexKey,
        blockNumber,
        'UsualM',
        'USD0',
        SwapSide.SELL,
        amountsForSell,
        '',
      );
    });

    it('getTopPoolsForToken: UsualM', async function () {
      const tokenA = Tokens[network]['UsualM'];
      const dexHelper = new DummyDexHelper(network);
      const usualMUsd0 = new UsualMUsd0(network, dexKey, dexHelper);

      const poolLiquidity = await usualMUsd0.getTopPoolsForToken(
        tokenA.address,
        10,
      );
      console.log(
        `${tokenA.symbol} Top Pools:`,
        JSON.stringify(poolLiquidity, null, 2),
      );

      checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
    });

    it('getTopPoolsForToken: USD0', async function () {
      const tokenA = Tokens[network]['USD0'];
      const dexHelper = new DummyDexHelper(network);
      const usualMUsd0 = new UsualMUsd0(network, dexKey, dexHelper);

      const poolLiquidity = await usualMUsd0.getTopPoolsForToken(
        tokenA.address,
        10,
      );
      console.log(
        `${tokenA.symbol} Top Pools:`,
        JSON.stringify(poolLiquidity, null, 2),
      );

      checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
    });
  });
});
