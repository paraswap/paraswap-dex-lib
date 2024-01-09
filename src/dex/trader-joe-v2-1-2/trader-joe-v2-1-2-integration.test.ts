/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, JsonFragment, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { TraderJoeV2_1 } from './trader-joe-v2-1-2';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import TraderJoeV21RouterABI from '../../abi/trader-joe-v2_1/RouterABI.json';
import { Address } from '@paraswap/core';

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  poolAddress: Address,
  swapForY: boolean,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      poolAddress,
      amount.toString(),
      swapForY,
    ]),
  }));
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
) {
  // TODO: Adapt this function for your needs
  return results.map(result => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    return BigInt(parsed[0]._hex);
  });
}

async function checkOnChainPricing(
  traderJoeV2_1: TraderJoeV2_1,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  poolAddress: Address,
  swapForY: boolean,
) {
  // Avalanche
  const exchangeAddress = '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30';

  const readerIface = new Interface(TraderJoeV21RouterABI as JsonFragment[]);

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    poolAddress,
    swapForY,
  );
  const readerResult = (
    await traderJoeV2_1.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  console.log('READER_RESULT: ', readerResult);
  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  console.log('EXPECTED_Prices: ', expectedPrices);
  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  traderJoeV2_1: TraderJoeV2_1,
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

  const pools = await traderJoeV2_1.getPoolIdentifiers(
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

  const poolPrices = await traderJoeV2_1.getPricesVolume(
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
  if (traderJoeV2_1.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  const token0 = traderJoeV2_1?.eventPools[pools[0]]?.token0;
  const poolAddress = traderJoeV2_1?.eventPools[pools[0]]?.poolAddress;

  expect(token0).toBeTruthy();
  expect(poolAddress).toBeTruthy();

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    traderJoeV2_1,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
    poolAddress!,
    networkTokens[srcTokenSymbol].address.toLowerCase() ===
      traderJoeV2_1?.eventPools[pools[0]]?.token0,
  );
}

describe('TraderJoeV2_1', function () {
  const dexKey = 'TraderJoeV2_1';
  let blockNumber: number;
  let traderJoeV2_1: TraderJoeV2_1;

  describe('AVALANCHE', () => {
    const network = Network.AVALANCHE;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // TODO: Put here token Symbol to check against
    // Don't forget to update relevant tokens in constant-e2e.ts
    const srcTokenSymbol = 'AVAX';
    const destTokenSymbol = 'USDC';

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

    const amountsForBuy = [
      0n,
      1n * BI_POWS[tokens[destTokenSymbol].decimals],
      2n * BI_POWS[tokens[destTokenSymbol].decimals],
      3n * BI_POWS[tokens[destTokenSymbol].decimals],
      4n * BI_POWS[tokens[destTokenSymbol].decimals],
      5n * BI_POWS[tokens[destTokenSymbol].decimals],
      6n * BI_POWS[tokens[destTokenSymbol].decimals],
      7n * BI_POWS[tokens[destTokenSymbol].decimals],
      8n * BI_POWS[tokens[destTokenSymbol].decimals],
      9n * BI_POWS[tokens[destTokenSymbol].decimals],
      10n * BI_POWS[tokens[destTokenSymbol].decimals],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      traderJoeV2_1 = new TraderJoeV2_1(network, dexKey, dexHelper);
      if (traderJoeV2_1.initializePricing) {
        await traderJoeV2_1.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        traderJoeV2_1,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        'getSwapOut',
      );
    });

    // it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    //   await testPricingOnNetwork(
    //     traderJoeV2_1,
    //     network,
    //     dexKey,
    //     blockNumber,
    //     srcTokenSymbol,
    //     destTokenSymbol,
    //     SwapSide.BUY,
    //     amountsForBuy,
    //     'getSwapIn', // TODO: Put here proper function name to check pricing
    //   );
    // });

    // it('getTopPoolsForToken', async function () {
    //   // We have to check without calling initializePricing, because
    //   // pool-tracker is not calling that function
    //   const newTraderJoeV2_1 = new TraderJoeV2_1(network, dexKey, dexHelper);
    //   if (newTraderJoeV2_1.updatePoolState) {
    //     await newTraderJoeV2_1.updatePoolState();
    //   }
    //   const poolLiquidity = await newTraderJoeV2_1.getTopPoolsForToken(
    //     tokens[srcTokenSymbol].address,
    //     10,
    //   );
    //   console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

    //   if (!newTraderJoeV2_1.hasConstantPriceLargeAmounts) {
    //     checkPoolsLiquidity(
    //       poolLiquidity,
    //       Tokens[network][srcTokenSymbol].address,
    //       dexKey,
    //     );
    //   }
    // });
  });
});
