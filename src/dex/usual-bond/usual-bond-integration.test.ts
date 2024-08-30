/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, JsonFragment, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { UsualBond } from './usual-bond';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import USD0PP_ABI from '../../abi/usual-bond/usd0pp.abi.json';

/*
  README
  ======

  This test script adds tests for UsualBond general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover UsualBond specific
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
  // TODO: Put here additional arguments you need
) {
  console.log('exchangeAddress', exchangeAddress);
  console.log('funcName', funcName);
  console.log('amounts', amounts);
  console.log(
    amounts.map(amount => ({
      target: exchangeAddress,
      callData: readerIface.encodeFunctionData(funcName, [amount]),
    })),
  );
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [amount]),
  }));
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
  amounts: bigint[],
) {
  // TODO: Adapt this function for your needs
  return results.map(amounts => {
    // const parsed = readerIface.decodeFunctionResult(funcName, result);
    // return BigInt(parsed[0]._hex);
    return amounts;
  });
}

async function checkOnChainPricing(
  usualBond: UsualBond,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
) {
  const exchangeAddress = '0x35d8949372d46b7a3d5a56006ae77b215fc69bc0';

  console.log('prices', prices);
  console.log('amounts', amounts);

  // TODO: Replace dummy interface with the real one
  // Normally you can get it from usualBond.Iface or from eventPool.
  // It depends on your implementation
  const readerIface = new Interface(USD0PP_ABI as JsonFragment[]);

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts,
    funcName,
  );
  console.log(readerCallData);

  const readerResult = (
    await usualBond.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  console.log(readerResult);

  // return the amounts
  const expectedPrices = decodeReaderResult(
    readerResult,
    readerIface,
    'mint',
    amounts,
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  usualBond: UsualBond,
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

  const pools = await usualBond.getPoolIdentifiers(
    networkTokens['USD0'],
    networkTokens['USD0++'],
    side,
    blockNumber,
  );
  console.log(`${'USD0'} <> ${'USD0++'} Pool Identifiers: `, pools);

  expect(pools.length).toBeGreaterThan(0);

  const poolPrices = await usualBond.getPricesVolume(
    networkTokens['USD0'],
    networkTokens['USD0++'],
    amounts,
    side,
    blockNumber,
    pools,
  );
  console.log(`${'USD0'} <> ${'USD0++'} Pool Prices: `, poolPrices);

  expect(poolPrices).not.toBeNull();
  if (usualBond.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    usualBond,
    'mint',
    blockNumber,
    poolPrices![0].prices,
    amounts,
  );
}

describe('UsualBond', function () {
  const dexKey = 'UsualBond';
  let blockNumber: number;
  let usualBond: UsualBond;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // TODO: Put here token Symbol to check against
    // Don't forget to update relevant tokens in constant-e2e.ts

    const amountsForSell = [
      // 0n,
      1n * BI_POWS[18],
      // 2n * BI_POWS[18],
      // 3n * BI_POWS[18],
      // 4n * BI_POWS[18],
      // 5n * BI_POWS[18],
      // 6n * BI_POWS[18],
      // 7n * BI_POWS[18],
      // 8n * BI_POWS[18],
      // 9n * BI_POWS[18],
      // 10n * BI_POWS[18],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      usualBond = new UsualBond(network, dexKey, dexHelper);
      if (usualBond.initializePricing) {
        await usualBond.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        usualBond,
        network,
        dexKey,
        blockNumber,
        'USD0',
        'USD0++',
        SwapSide.SELL,
        amountsForSell,
        '', // TODO: Put here proper function name to check pricing
      );
    });
  });
});
