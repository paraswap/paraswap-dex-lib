/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { UsualMSmartM } from './usual-m-smart-m';
import {
  checkPoolPrices,
  checkConstantPoolPrices,
  checkPoolsLiquidity,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

async function testPricingOnNetwork(
  usualMSmartM: UsualMSmartM,
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
    networkTokens['SmartM'],
    networkTokens['UsualM'],
    side,
    blockNumber,
  );
  console.log(`${'SmartM'} <> ${'UsualM'} Pool Identifiers: `, pools);

  expect(pools.length).toBeGreaterThan(0);

  const poolPrices = await usualMSmartM.getPricesVolume(
    networkTokens['SmartM'],
    networkTokens['UsualM'],
    amounts,
    side,
    blockNumber,
    pools,
  );
  console.log(`${'SmartM'} <> ${'UsualM'} Pool Prices: `, poolPrices);

  expect(poolPrices).not.toBeNull();
  if (usualMSmartM.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  checkPoolPrices(poolPrices!, amounts, side, dexKey);
}

describe('SmartM<>UsualM', function () {
  const dexKey = 'UsualMSmartM';
  let blockNumber: number;
  let usualMSmartM: UsualMSmartM;

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
      usualMSmartM = new UsualMSmartM(network, dexKey, dexHelper);
      if (usualMSmartM.initializePricing) {
        await usualMSmartM.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        usualMSmartM,
        network,
        dexKey,
        blockNumber,
        'SmartM',
        'UsualM',
        SwapSide.SELL,
        amountsForSell,
        '',
      );
    });

    it('getTopPoolsForToken: SmartM', async function () {
      const tokenA = Tokens[network]['SmartM'];
      const dexHelper = new DummyDexHelper(network);
      const usualMSmartM = new UsualMSmartM(network, dexKey, dexHelper);

      const poolLiquidity = await usualMSmartM.getTopPoolsForToken(
        tokenA.address,
        10,
      );
      console.log(
        `${tokenA.symbol} Top Pools:`,
        JSON.stringify(poolLiquidity, null, 2),
      );

      checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
    });

    it('getTopPoolsForToken: UsualM', async function () {
      const tokenA = Tokens[network]['UsualM'];
      const dexHelper = new DummyDexHelper(network);
      const usualMSmartM = new UsualMSmartM(network, dexKey, dexHelper);

      const poolLiquidity = await usualMSmartM.getTopPoolsForToken(
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
