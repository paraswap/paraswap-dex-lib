/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { AngleStakedStable } from './angle-staked-stable';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { AngleStakedStableEventPool } from './angle-staked-stable-pool';

/*
  README
  ======

  This test script adds tests for AngleStakedStable general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover AngleStakedStable specific
  logic.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-integration.test.ts`

  (This comment should be removed from the final implementation)
*/

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [amount]),
  }));
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
) {
  return results.map(result => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    return BigInt(parsed[0]._hex);
  });
}

async function checkOnChainPricing(
  angleStakedStable: AngleStakedStable,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
) {
  const exchangeAddress = '0x004626a008b1acdc4c74ab51644093b155e59a23';

  // Normally you can get it from angleStakedStable.Iface or from eventPool.
  // It depends on your implementation
  const readerIface = AngleStakedStableEventPool.angleStakedStableIface;

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
  );
  const readerResult = (
    await angleStakedStable.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  // No exact computation because of the bigInt approx
  // for (let i = 0; i < expectedPrices.length; ++i) {
  //   expect(prices[i]).toBeGreaterThanOrEqual(expectedPrices[i] - 1n);
  //   expect(prices[i]).toBeLessThanOrEqual(expectedPrices[i] + 1n);
  // }

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  angleStakedStable: AngleStakedStable,
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

  const pools = await angleStakedStable.getPoolIdentifiers(
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

  const poolPrices = await angleStakedStable.getPricesVolume(
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
  if (angleStakedStable.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    angleStakedStable,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
  );
}

describe('AngleStakedStable', () => {
  const dexKey = 'AngleStakedStable';
  let blockNumber: number;
  let angleStakedStable: AngleStakedStable;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // Don't forget to update relevant tokens in constant-e2e.ts
    const srcTokenSymbolEnter = 'EURA';
    const destTokenSymbolEnter = 'stEUR';
    const funcNameSellEnter = 'previewDeposit';
    const funcNameBuyEnter = 'previewMint';

    const srcTokenSymbolExit = 'stEUR';
    const destTokenSymbolExit = 'EURA';
    const funcNameSellExit = 'previewRedeem';
    const funcNameBuyExit = 'previewWithdraw';

    const amountsForSell = [
      0n,
      1n * BI_POWS[tokens[srcTokenSymbolEnter].decimals],
      2n * BI_POWS[tokens[srcTokenSymbolEnter].decimals],
      3n * BI_POWS[tokens[srcTokenSymbolEnter].decimals],
      4n * BI_POWS[tokens[srcTokenSymbolEnter].decimals],
      5n * BI_POWS[tokens[srcTokenSymbolEnter].decimals],
      6n * BI_POWS[tokens[srcTokenSymbolEnter].decimals],
      7n * BI_POWS[tokens[srcTokenSymbolEnter].decimals],
      8n * BI_POWS[tokens[srcTokenSymbolEnter].decimals],
      9n * BI_POWS[tokens[srcTokenSymbolEnter].decimals],
      10n * BI_POWS[tokens[srcTokenSymbolEnter].decimals],
    ];

    const amountsForBuy = [
      0n,
      1n * BI_POWS[tokens[destTokenSymbolEnter].decimals],
      2n * BI_POWS[tokens[destTokenSymbolEnter].decimals],
      3n * BI_POWS[tokens[destTokenSymbolEnter].decimals],
      4n * BI_POWS[tokens[destTokenSymbolEnter].decimals],
      5n * BI_POWS[tokens[destTokenSymbolEnter].decimals],
      6n * BI_POWS[tokens[destTokenSymbolEnter].decimals],
      7n * BI_POWS[tokens[destTokenSymbolEnter].decimals],
      8n * BI_POWS[tokens[destTokenSymbolEnter].decimals],
      9n * BI_POWS[tokens[destTokenSymbolEnter].decimals],
      10n * BI_POWS[tokens[destTokenSymbolEnter].decimals],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      angleStakedStable = new AngleStakedStable(network, dexKey, dexHelper);
      if (angleStakedStable.initializePricing) {
        await angleStakedStable.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL - EURA', async () => {
      await testPricingOnNetwork(
        angleStakedStable,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbolEnter,
        destTokenSymbolEnter,
        SwapSide.SELL,
        amountsForSell,
        funcNameSellEnter,
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY - stEUR', async () => {
      await testPricingOnNetwork(
        angleStakedStable,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbolEnter,
        destTokenSymbolEnter,
        SwapSide.BUY,
        amountsForBuy,
        funcNameBuyEnter,
      );
    });

    it('getPoolIdentifiers and getPricesVolume SELL - stEUR', async () => {
      await testPricingOnNetwork(
        angleStakedStable,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbolExit,
        destTokenSymbolExit,
        SwapSide.SELL,
        amountsForSell,
        funcNameSellExit,
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY - EURA', async () => {
      await testPricingOnNetwork(
        angleStakedStable,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbolExit,
        destTokenSymbolExit,
        SwapSide.BUY,
        amountsForBuy,
        funcNameBuyExit,
      );
    });

    it('getTopPoolsForToken -EURA', async () => {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newAngleStakedStable = new AngleStakedStable(
        network,
        dexKey,
        dexHelper,
      );
      if (newAngleStakedStable.updatePoolState) {
        await newAngleStakedStable.updatePoolState();
      }
      const poolLiquidity = await newAngleStakedStable.getTopPoolsForToken(
        tokens[srcTokenSymbolEnter].address,
        10,
      );
      console.log(`${srcTokenSymbolEnter} Top Pools:`, poolLiquidity);

      if (!newAngleStakedStable.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbolEnter].address,
          dexKey,
        );
      }
    });

    it('getTopPoolsForToken - stEUR', async () => {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newAngleStakedStable = new AngleStakedStable(
        network,
        dexKey,
        dexHelper,
      );
      if (newAngleStakedStable.updatePoolState) {
        await newAngleStakedStable.updatePoolState();
      }
      const poolLiquidity = await newAngleStakedStable.getTopPoolsForToken(
        tokens[srcTokenSymbolExit].address,
        10,
      );
      console.log(`${srcTokenSymbolExit} Top Pools:`, poolLiquidity);

      if (!newAngleStakedStable.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbolExit].address,
          dexKey,
        );
      }
    });
  });
});
