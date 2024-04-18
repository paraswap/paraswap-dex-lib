/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { AngleTransmuter } from './angle-transmuter';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { AngleTransmuterEventPool } from './angle-transmuter-pool';
import { Address } from '../../types';

/*
  README
  ======

  This test script adds tests for AngleTransmuter general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover AngleTransmuter specific
  logic.

  You can run this individual test script by running:
  `npx jest src/dex/angle-transmuter/angle-transmuter-integration.test.ts`

  (This comment should be removed from the final implementation)
*/

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  tokenIn: Address,
  tokenOut: Address,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      amount,
      tokenIn,
      tokenOut,
    ]),
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
  angleTransmuter: AngleTransmuter,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  tokenIn: Address,
  tokenOut: Address,
) {
  const exchangeAddress = '0x00253582b2a3FE112feEC532221d9708c64cEFAb';
  const readerIface = AngleTransmuterEventPool.angleTransmuterIface;

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    tokenIn,
    tokenOut,
  );
  const readerResult = (
    await angleTransmuter.dexHelper.multiContract.methods
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
  angleTransmuter: AngleTransmuter,
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

  const pools = await angleTransmuter.getPoolIdentifiers(
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

  const poolPrices = await angleTransmuter.getPricesVolume(
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
  if (angleTransmuter.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    angleTransmuter,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
    networkTokens[srcTokenSymbol].address,
    networkTokens[destTokenSymbol].address,
  );
}

describe('AngleTransmuter', () => {
  const dexKey = 'AngleTransmuter';
  let blockNumber: number;
  let angleTransmuter: AngleTransmuter;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const eurocSymbol = 'EUROC';
    const bC3MSymbol = 'bC3M';
    const bERNXSymbol = 'bERNX';
    const euraSymbol = 'EURA';

    const amountsEUROC = [
      0n,
      1n * BI_POWS[tokens[eurocSymbol].decimals],
      2n * BI_POWS[tokens[eurocSymbol].decimals],
      3n * BI_POWS[tokens[eurocSymbol].decimals],
      4n * BI_POWS[tokens[eurocSymbol].decimals],
      5n * BI_POWS[tokens[eurocSymbol].decimals],
      6n * BI_POWS[tokens[eurocSymbol].decimals],
      7n * BI_POWS[tokens[eurocSymbol].decimals],
      8n * BI_POWS[tokens[eurocSymbol].decimals],
      9n * BI_POWS[tokens[eurocSymbol].decimals],
      10n * BI_POWS[tokens[eurocSymbol].decimals],
    ];

    const amountsEURA = [
      0n,
      1n * BI_POWS[tokens[euraSymbol].decimals],
      2n * BI_POWS[tokens[euraSymbol].decimals],
      3n * BI_POWS[tokens[euraSymbol].decimals],
      4n * BI_POWS[tokens[euraSymbol].decimals],
      5n * BI_POWS[tokens[euraSymbol].decimals],
      6n * BI_POWS[tokens[euraSymbol].decimals],
      7n * BI_POWS[tokens[euraSymbol].decimals],
      8n * BI_POWS[tokens[euraSymbol].decimals],
      9n * BI_POWS[tokens[euraSymbol].decimals],
      10n * BI_POWS[tokens[euraSymbol].decimals],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      angleTransmuter = new AngleTransmuter(network, dexKey, dexHelper);
      if (angleTransmuter.initializePricing) {
        await angleTransmuter.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL - EUROC', async () => {
      await testPricingOnNetwork(
        angleTransmuter,
        network,
        dexKey,
        blockNumber,
        eurocSymbol,
        euraSymbol,
        SwapSide.SELL,
        amountsEUROC,
        'quoteIn',
      );
    });

    it('getPoolIdentifiers and getPricesVolume SELL - EURA', async () => {
      await testPricingOnNetwork(
        angleTransmuter,
        network,
        dexKey,
        blockNumber,
        euraSymbol,
        eurocSymbol,
        SwapSide.SELL,
        amountsEURA,
        'quoteIn',
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY - EUROC', async () => {
      await testPricingOnNetwork(
        angleTransmuter,
        network,
        dexKey,
        blockNumber,
        eurocSymbol,
        euraSymbol,
        SwapSide.BUY,
        amountsEURA,
        'quoteOut',
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY - EURA', async () => {
      await testPricingOnNetwork(
        angleTransmuter,
        network,
        dexKey,
        blockNumber,
        euraSymbol,
        eurocSymbol,
        SwapSide.BUY,
        amountsEUROC,
        'quoteOut',
      );
    });

    it('getTopPoolsForToken - EUROC', async () => {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newAngleTransmuter = new AngleTransmuter(
        network,
        dexKey,
        dexHelper,
      );
      if (newAngleTransmuter.updatePoolState) {
        await newAngleTransmuter.updatePoolState();
      }
      const poolLiquidity = await newAngleTransmuter.getTopPoolsForToken(
        tokens[eurocSymbol].address,
        10,
      );
      console.log(`${eurocSymbol} Top Pools:`, poolLiquidity);

      if (!newAngleTransmuter.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][eurocSymbol].address,
          dexKey,
        );
      }
    });

    it('getTopPoolsForToken - EURA', async () => {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newAngleTransmuter = new AngleTransmuter(
        network,
        dexKey,
        dexHelper,
      );
      if (newAngleTransmuter.updatePoolState) {
        await newAngleTransmuter.updatePoolState();
      }
      const poolLiquidity = await newAngleTransmuter.getTopPoolsForToken(
        tokens[euraSymbol].address,
        10,
      );
      console.log(`${euraSymbol} Top Pools:`, poolLiquidity);

      if (!newAngleTransmuter.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][euraSymbol].address,
          dexKey,
        );
      }
    });
  });
});
