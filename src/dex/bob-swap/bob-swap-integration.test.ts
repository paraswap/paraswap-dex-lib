/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { BobSwap } from './bob-swap';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { Address } from '@paraswap/core';
import BobVaultABI from '../../abi/bob-swap/BobVault.json';

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  srcTokenAddress: Address,
  destTokenAddress: Address,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      srcTokenAddress,
      destTokenAddress,
      amount,
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
  bobSwap: BobSwap,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  srcTokenAddress: Address,
  destTokenAddress: Address,
) {
  const exchangeAddress = bobSwap.config.bobSwapAddress;

  const readerIface = new Interface(BobVaultABI);

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    srcTokenAddress,
    destTokenAddress,
  );
  const readerResult = (
    await bobSwap.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  bobSwap: BobSwap,
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

  const pools = await bobSwap.getPoolIdentifiers(
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

  const poolPrices = await bobSwap.getPricesVolume(
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
  if (bobSwap.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    bobSwap,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
    networkTokens[srcTokenSymbol].address,
    networkTokens[destTokenSymbol].address,
  );
}

function testNetwork(network: number) {
  const dexKey = 'BobSwap';
  let blockNumber: number;
  let bobSwap: BobSwap;

  const dexHelper = new DummyDexHelper(network);

  const tokens = Tokens[network];

  const bobTokenSymbol = 'BOB';
  const srcTokenSymbol = 'USDC';
  const destTokenSymbol = 'USDT';

  const amountsForSell = [
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
    bobSwap = new BobSwap(network, dexKey, dexHelper);
    if (bobSwap.initializePricing) {
      await bobSwap.initializePricing(blockNumber);
    }
  });

  it('getPoolIdentifiers and getPricesVolume SELL BOB -> Token', async function () {
    await testPricingOnNetwork(
      bobSwap,
      network,
      dexKey,
      blockNumber,
      bobTokenSymbol,
      destTokenSymbol,
      SwapSide.SELL,
      amountsForSell,
      'getAmountOut',
    );
  });

  it('getPoolIdentifiers and getPricesVolume SELL Token -> BOB', async function () {
    await testPricingOnNetwork(
      bobSwap,
      network,
      dexKey,
      blockNumber,
      destTokenSymbol,
      bobTokenSymbol,
      SwapSide.SELL,
      amountsForSell,
      'getAmountOut',
    );
  });

  it('getPoolIdentifiers and getPricesVolume SELL Token -> Token', async function () {
    let amounts = amountsForSell;
    if (network == Network.POLYGON) {
      // Currently we have only dust as USDT amount and getAmountOut reverts, if the swap won't be successful
      amounts = amounts.map(amount => {
        return amount / BigInt(100);
      });
    }

    await testPricingOnNetwork(
      bobSwap,
      network,
      dexKey,
      blockNumber,
      srcTokenSymbol,
      destTokenSymbol,
      SwapSide.SELL,
      amounts,
      'getAmountOut',
    );
  });

  it('getTopPoolsForToken', async function () {
    // We have to check without calling initializePricing, because
    // pool-tracker is not calling that function
    const newBobSwap = new BobSwap(network, dexKey, dexHelper);
    if (newBobSwap.updatePoolState) {
      await newBobSwap.updatePoolState();
    }
    const poolLiquidity = await newBobSwap.getTopPoolsForToken(
      tokens[srcTokenSymbol].address,
      10,
    );
    console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

    if (!newBobSwap.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(
        poolLiquidity,
        Tokens[network][srcTokenSymbol].address,
        dexKey,
      );
    }
  });
}

describe('BobSwap', function () {
  describe('Polygon', () => {
    const network = Network.POLYGON;
    testNetwork(network);
  });
  describe('Mainnet', () => {
    const network = Network.MAINNET;
    testNetwork(network);
  });
  describe('Optimism', () => {
    const network = Network.OPTIMISM;
    testNetwork(network);
  });
  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    testNetwork(network);
  });
  describe('Binance Smart Chain', () => {
    const network = Network.BSC;
    testNetwork(network);
  });
});
