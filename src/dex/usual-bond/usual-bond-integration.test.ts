/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
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
import { UsualBondConfig } from './config';

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
  results: any[],
  readerIface: Interface,
  funcName: string,
) {
  return results.map(result => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    return BigInt(parsed[0]._hex);
  });
}

async function checkOnChainPricing(
  usualBond: UsualBond,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
) {
  const { usd0ppAddress } = UsualBondConfig.UsualBond[Network.MAINNET];
  const readerIface = usualBond.usd0ppIface;

  const readerCallData = getReaderCalldata(
    usd0ppAddress,
    readerIface,
    amounts.slice(1),
    funcName,
  );
  const readerResult = (
    await usualBond.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPoolIdentifiers(
  usualBond: UsualBond,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
) {
  const networkTokens = Tokens[network];

  console.log('Source Token:', networkTokens[srcTokenSymbol]);
  console.log('Destination Token:', networkTokens[destTokenSymbol]);

  const pools = await usualBond.getPoolIdentifiers(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    SwapSide.SELL,
    blockNumber,
  );
  console.log(`Source Token: ${srcTokenSymbol}`);
  console.log(`Destination Token: ${destTokenSymbol}`);
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Identifiers: `,
    pools,
  );

  expect(pools.length).toBeGreaterThan(0);
}

async function testPricingOnNetwork(
  usualBond: UsualBond,
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

  const pools = await usualBond.getPoolIdentifiers(
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

  const poolPrices = await usualBond.getPricesVolume(
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
  checkConstantPoolPrices(poolPrices!, amounts, dexKey);

  await checkOnChainPricing(
    usualBond,
    funcNameToCheck,
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
    // Print only the last two tokens

    const srcTokenSymbol = 'USD0';
    const destTokenSymbol = 'USD0++';

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
      usualBond = new UsualBond(network, dexKey, dexHelper);
      await usualBond.initializePricing(blockNumber);
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        usualBond,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol, // USD0
        destTokenSymbol, // USD0++
        SwapSide.SELL,
        amountsForSell,
        'mint',
      );
    });

    it('getTopPoolsForToken', async function () {
      const newUsualBond = new UsualBond(network, dexKey, dexHelper);
      const poolLiquidity = await newUsualBond.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(
        poolLiquidity,
        tokens[srcTokenSymbol].address,
        dexKey,
      );
    });
  });
});

describe('UsualBond', function () {
  const dexKey = 'UsualBond';
  let blockNumber: number;
  let usualBond: UsualBond;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'USD0';
    const destTokenSymbol = 'USD0++';

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
      usualBond = new UsualBond(network, dexKey, dexHelper);
      await usualBond.initializePricing(blockNumber);
    });

    it('getPoolIdentifiers ', async function () {
      await testPoolIdentifiers(
        usualBond,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol, // USD0
        destTokenSymbol, // USD0++
      );
    });
  });
});
