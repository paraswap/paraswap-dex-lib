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
  exchangeAddress: string,
  prices: bigint[],
  amounts: bigint[],
) {
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
  for (let i = 0; i < expectedPrices.length; ++i) {
    expect(prices[i]).toBeGreaterThanOrEqual(
      (expectedPrices[i] * 99999n) / 100000n,
    );
    expect(prices[i]).toBeLessThanOrEqual(
      (expectedPrices[i] * 100001n) / 100000n,
    );
  }
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

  const exchange =
    srcTokenSymbol === 'stEUR' || srcTokenSymbol === 'stUSD'
      ? networkTokens[srcTokenSymbol].address
      : networkTokens[destTokenSymbol].address;

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    angleStakedStable,
    funcNameToCheck,
    blockNumber,
    exchange,
    poolPrices![0].prices,
    amounts,
  );
}

describe('AngleStakedStable', () => {
  describe('Mainnet USD', () => {
    let blockNumber: number;
    let angleStakedStable: AngleStakedStable;
    const dexKey = 'AngleStakedStableUSD';
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbolUSDEnter = 'USDA';
    const destTokenSymbolUSDEnter = 'stUSD';
    const funcNameSellEnter = 'previewDeposit';
    const funcNameBuyEnter = 'previewMint';

    const destTokenSymbolUSDExit = 'USDA';
    const srcTokenSymbolUSDExit = 'stUSD';
    const funcNameSellExit = 'previewRedeem';
    const funcNameBuyExit = 'previewWithdraw';

    const exchangeSTUSD = dexKey;
    // const exchangeSTUSD = `${dexKey}_${tokens.stUSD.address.toLowerCase()}`;

    const amountsForSell = [
      0n,
      1n * BI_POWS[tokens[srcTokenSymbolUSDEnter].decimals],
      2n * BI_POWS[tokens[srcTokenSymbolUSDEnter].decimals],
      3n * BI_POWS[tokens[srcTokenSymbolUSDEnter].decimals],
      4n * BI_POWS[tokens[srcTokenSymbolUSDEnter].decimals],
      5n * BI_POWS[tokens[srcTokenSymbolUSDEnter].decimals],
      6n * BI_POWS[tokens[srcTokenSymbolUSDEnter].decimals],
      7n * BI_POWS[tokens[srcTokenSymbolUSDEnter].decimals],
      8n * BI_POWS[tokens[srcTokenSymbolUSDEnter].decimals],
      9n * BI_POWS[tokens[srcTokenSymbolUSDEnter].decimals],
      10n * BI_POWS[tokens[srcTokenSymbolUSDEnter].decimals],
    ];

    const amountsForBuy = [
      0n,
      1n * BI_POWS[tokens[destTokenSymbolUSDEnter].decimals],
      2n * BI_POWS[tokens[destTokenSymbolUSDEnter].decimals],
      3n * BI_POWS[tokens[destTokenSymbolUSDEnter].decimals],
      4n * BI_POWS[tokens[destTokenSymbolUSDEnter].decimals],
      5n * BI_POWS[tokens[destTokenSymbolUSDEnter].decimals],
      6n * BI_POWS[tokens[destTokenSymbolUSDEnter].decimals],
      7n * BI_POWS[tokens[destTokenSymbolUSDEnter].decimals],
      8n * BI_POWS[tokens[destTokenSymbolUSDEnter].decimals],
      9n * BI_POWS[tokens[destTokenSymbolUSDEnter].decimals],
      10n * BI_POWS[tokens[destTokenSymbolUSDEnter].decimals],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      angleStakedStable = new AngleStakedStable(network, dexKey, dexHelper);
      if (angleStakedStable.initializePricing) {
        await angleStakedStable.initializePricing(blockNumber);
      }
    });
    it('getPoolIdentifiers and getPricesVolume SELL - USDA', async () => {
      await testPricingOnNetwork(
        angleStakedStable,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbolUSDEnter,
        destTokenSymbolUSDEnter,
        SwapSide.SELL,
        amountsForSell,
        funcNameSellEnter,
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY - stUSD', async () => {
      await testPricingOnNetwork(
        angleStakedStable,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbolUSDEnter,
        destTokenSymbolUSDEnter,
        SwapSide.BUY,
        amountsForBuy,
        funcNameBuyEnter,
      );
    });

    it('getPoolIdentifiers and getPricesVolume SELL - stUSD', async () => {
      await testPricingOnNetwork(
        angleStakedStable,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbolUSDExit,
        destTokenSymbolUSDExit,
        SwapSide.SELL,
        amountsForSell,
        funcNameSellExit,
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY - USDA', async () => {
      await testPricingOnNetwork(
        angleStakedStable,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbolUSDExit,
        destTokenSymbolUSDExit,
        SwapSide.BUY,
        amountsForBuy,
        funcNameBuyExit,
      );
    });

    it('getTopPoolsForToken - USDA', async () => {
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
        tokens[srcTokenSymbolUSDEnter].address,
        10,
      );
      console.log(`${srcTokenSymbolUSDEnter} Top Pools:`, poolLiquidity);

      if (!newAngleStakedStable.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbolUSDEnter].address,
          exchangeSTUSD,
        );
      }
    });

    it('getTopPoolsForToken - stUSD', async () => {
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
        tokens[srcTokenSymbolUSDExit].address,
        10,
      );
      console.log(`${srcTokenSymbolUSDExit} Top Pools:`, poolLiquidity);

      if (!newAngleStakedStable.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbolUSDExit].address,
          exchangeSTUSD,
        );
      }
    });
  });

  describe('Mainnet EUR', () => {
    let blockNumber: number;
    let angleStakedStable: AngleStakedStable;
    const dexKey = 'AngleStakedStableEUR';
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // Don't forget to update relevant tokens in constant-e2e.ts
    const srcTokenSymbolEUREnter = 'EURA';
    const destTokenSymbolEUREnter = 'stEUR';
    const funcNameSellEnter = 'previewDeposit';
    const funcNameBuyEnter = 'previewMint';

    const srcTokenSymbolEURExit = 'stEUR';
    const destTokenSymbolEURExit = 'EURA';
    const funcNameSellExit = 'previewRedeem';
    const funcNameBuyExit = 'previewWithdraw';

    // const exchangeSTEUR = `${dexKey}_${tokens.stEUR.address.toLowerCase()}`;
    const exchangeSTEUR = dexKey;

    const amountsForSell = [
      0n,
      1n * BI_POWS[tokens[srcTokenSymbolEUREnter].decimals],
      2n * BI_POWS[tokens[srcTokenSymbolEUREnter].decimals],
      3n * BI_POWS[tokens[srcTokenSymbolEUREnter].decimals],
      4n * BI_POWS[tokens[srcTokenSymbolEUREnter].decimals],
      5n * BI_POWS[tokens[srcTokenSymbolEUREnter].decimals],
      6n * BI_POWS[tokens[srcTokenSymbolEUREnter].decimals],
      7n * BI_POWS[tokens[srcTokenSymbolEUREnter].decimals],
      8n * BI_POWS[tokens[srcTokenSymbolEUREnter].decimals],
      9n * BI_POWS[tokens[srcTokenSymbolEUREnter].decimals],
      10n * BI_POWS[tokens[srcTokenSymbolEUREnter].decimals],
    ];

    const amountsForBuy = [
      0n,
      1n * BI_POWS[tokens[destTokenSymbolEUREnter].decimals],
      2n * BI_POWS[tokens[destTokenSymbolEUREnter].decimals],
      3n * BI_POWS[tokens[destTokenSymbolEUREnter].decimals],
      4n * BI_POWS[tokens[destTokenSymbolEUREnter].decimals],
      5n * BI_POWS[tokens[destTokenSymbolEUREnter].decimals],
      6n * BI_POWS[tokens[destTokenSymbolEUREnter].decimals],
      7n * BI_POWS[tokens[destTokenSymbolEUREnter].decimals],
      8n * BI_POWS[tokens[destTokenSymbolEUREnter].decimals],
      9n * BI_POWS[tokens[destTokenSymbolEUREnter].decimals],
      10n * BI_POWS[tokens[destTokenSymbolEUREnter].decimals],
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
        srcTokenSymbolEUREnter,
        destTokenSymbolEUREnter,
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
        srcTokenSymbolEUREnter,
        destTokenSymbolEUREnter,
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
        srcTokenSymbolEURExit,
        destTokenSymbolEURExit,
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
        srcTokenSymbolEURExit,
        destTokenSymbolEURExit,
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
        tokens[srcTokenSymbolEUREnter].address,
        10,
      );
      console.log(`${srcTokenSymbolEUREnter} Top Pools:`, poolLiquidity);

      if (!newAngleStakedStable.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbolEUREnter].address,
          exchangeSTEUR,
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
        tokens[srcTokenSymbolEURExit].address,
        10,
      );
      console.log(`${srcTokenSymbolEURExit} Top Pools:`, poolLiquidity);

      if (!newAngleStakedStable.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbolEURExit].address,
          exchangeSTEUR,
        );
      }
    });
  });
});
