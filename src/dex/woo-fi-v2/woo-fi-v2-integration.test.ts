/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { WooFiV2 } from './woo-fi-v2';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { Address } from '@paraswap/core';
import { ifaces } from './utils';

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
  wooFiV2: WooFiV2,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  srcTokenAddress: Address,
  destTokenAddress: Address,
) {
  const exchangeAddress = wooFiV2.config.wooPPV2Address;

  const readerIface = ifaces.PPV2;

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    srcTokenAddress,
    destTokenAddress,
  );
  const readerResult = (
    await wooFiV2.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  wooFiV2: WooFiV2,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
  funcNameToCheck: string,
  expectNoLiquidity: boolean = false,
) {
  const networkTokens = Tokens[network];

  const pools = await wooFiV2.getPoolIdentifiers(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    side,
    blockNumber,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Identifiers: `,
    pools,
  );

  if (expectNoLiquidity) {
    expect(pools.length).toEqual(0);
    return;
  }

  expect(pools.length).toBeGreaterThan(0);

  const poolPrices = await wooFiV2.getPricesVolume(
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
  if (wooFiV2.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    wooFiV2,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
    networkTokens[srcTokenSymbol].address,
    networkTokens[destTokenSymbol].address,
  );
}

describe('WooFiV2', function () {
  const dexKey = 'WooFiV2';
  let blockNumber: number;
  let wooFiV2: WooFiV2;

  describe('BSC', () => {
    const network = Network.BSC;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'WBNB';
    const destTokenSymbol = 'BUSD';
    const untradableSymbol = 'ETH';

    const pricingCheckFuncName = 'tryQuery';

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
      wooFiV2 = new WooFiV2(network, dexKey, dexHelper);
      if (wooFiV2.initializePricing) {
        await wooFiV2.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL -> Base-Quote', async function () {
      await testPricingOnNetwork(
        wooFiV2,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        pricingCheckFuncName,
      );
    });

    it('getPoolIdentifiers and getPricesVolume SELL -> Quote-Base', async function () {
      await testPricingOnNetwork(
        wooFiV2,
        network,
        dexKey,
        blockNumber,
        destTokenSymbol,
        srcTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        pricingCheckFuncName,
      );
    });

    it('getPoolIdentifiers and getPricesVolume SELL No Pool', async function () {
      await testPricingOnNetwork(
        wooFiV2,
        network,
        dexKey,
        blockNumber,
        untradableSymbol,
        srcTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        pricingCheckFuncName,
        true,
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newWooFiV2 = new WooFiV2(network, dexKey, dexHelper);
      if (newWooFiV2.updatePoolState) {
        await newWooFiV2.updatePoolState();
      }
      const poolLiquidity = await newWooFiV2.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newWooFiV2.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
