/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { WUSDM } from './wusdm';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

/*
  README
  ======

  This test script adds tests for WUSDM general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover WUSDM specific
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
  mountainProtocol: WUSDM,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
) {
  const exchangeAddress = '0x57f5e098cad7a3d1eed53991d4d66c45c9af7812';

  // TODO: Replace dummy interface with the real one
  // Normally you can get it from mountainProtocol.Iface or from eventPool.
  // It depends on your implementation
  const readerIface = WUSDM.wUSDMIface;

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
  );
  const readerResult = (
    await mountainProtocol.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  mountainProtocol: WUSDM,
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

  const pools = await mountainProtocol.getPoolIdentifiers(
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

  const poolPrices = await mountainProtocol.getPricesVolume(
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
  checkPoolPrices(poolPrices!, amounts, side, dexKey);

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    mountainProtocol,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
  );
}

describe('WUSDM', function () {
  const dexKey = 'wUSDM';
  let blockNumber: number;
  let mountainProtocol: WUSDM;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // TODO: Put here token Symbol to check against
    // Don't forget to update relevant tokens in constant-e2e.ts
    const usdmTokenSymbol = 'USDM';
    const wusdmTokenSymbol = 'wUSDM';

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
      mountainProtocol = new WUSDM(network, dexKey, dexHelper);
    });

    it('getPoolIdentifiers and getPricesVolume SELL wUSDM->USDM', async function () {
      await testPricingOnNetwork(
        mountainProtocol,
        network,
        dexKey,
        blockNumber,
        wusdmTokenSymbol,
        usdmTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        'convertToAssets',
      );
    });

    it('getPoolIdentifiers and getPricesVolume SELL USDM->wUSDM', async function () {
      await testPricingOnNetwork(
        mountainProtocol,
        network,
        dexKey,
        blockNumber,
        usdmTokenSymbol,
        wusdmTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        'convertToShares',
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newWUSDM = new WUSDM(network, dexKey, dexHelper);

      const poolLiquidity = await newWUSDM.getTopPoolsForToken(
        tokens[usdmTokenSymbol].address,
        10,
      );
      console.log(`${usdmTokenSymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(
        poolLiquidity,
        Tokens[network][usdmTokenSymbol].address,
        dexKey,
      );
    });
  });
});
