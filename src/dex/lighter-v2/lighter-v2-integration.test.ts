/* eslint-disable no-console */
import dotenv from 'dotenv';

dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { LighterV2 } from './lighter-v2';
import { checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { SwapSide } from '@paraswap/core';

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  orderBookId: number,
  isAsk: boolean,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      orderBookId,
      isAsk,
      amount,
    ]),
  }));
}

// only returns quotedOutput
function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
) {
  return results.map(result => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    if (funcName == 'getQuoteForExactInput') {
      return BigInt(parsed[1]._hex);
    } else {
      return BigInt(parsed[0]._hex);
    }
  });
}

async function checkOnChainPricing(
  lighterV2: LighterV2,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  orderBookId: number,
  isAsk: boolean,
  isExactInput: boolean,
) {
  const exchangeAddress = lighterV2.config.router;
  const readerIface = lighterV2.routerContract.interface;

  const funcName = isExactInput
    ? 'getQuoteForExactInput'
    : 'getQuoteForExactOutput';

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    orderBookId,
    isAsk,
  );

  const readerResult = (
    await lighterV2.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  lighterV2: LighterV2,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
) {
  const networkTokens = Tokens[network];

  const pools = await lighterV2.getPoolIdentifiers(
    networkTokens[srcTokenSymbol],
    networkTokens[destTokenSymbol],
    side,
    blockNumber,
  );
  console.log(
    `${srcTokenSymbol} <> ${destTokenSymbol} Pool Identifiers: `,
    pools,
  );

  // there should be 1 pool only and it should be defined
  expect(pools.length).toEqual(1);
  const pool = lighterV2.getPoolByIdentifier(pools[0]);
  expect(pool).not.toBeUndefined();

  const poolPrices = await lighterV2.getPricesVolume(
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
  // if (lighterV2.hasConstantPriceLargeAmounts) {
  //   checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  // } else {
  //   checkPoolPrices(poolPrices!, amounts, side, dexKey);
  // }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    lighterV2,
    blockNumber,
    poolPrices![0].prices,
    amounts,
    pool!.pool.orderBookId,
    pool!.isAsk,
    side == SwapSide.SELL,
  );
}

describe('LighterV2', function () {
  const dexKey = 'LighterV2';
  let blockNumber: number;
  let lighterV2: LighterV2;

  describe('ARBITRUM', () => {
    const network = Network.ARBITRUM;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];
    const weth = 'WETH';
    const usdc = 'USDCe';

    const amountsWETH = [
      0n,
      11n * BI_POWS[tokens[weth].decimals - 2],
      212n * BI_POWS[tokens[weth].decimals - 3],
      3123n * BI_POWS[tokens[weth].decimals - 4],
      41234n * BI_POWS[tokens[weth].decimals - 5],
      512345n * BI_POWS[tokens[weth].decimals - 6],
      6123456n * BI_POWS[tokens[weth].decimals - 7],
      71234567n * BI_POWS[tokens[weth].decimals - 8],
      812345678n * BI_POWS[tokens[weth].decimals - 9],
      9123456789n * BI_POWS[tokens[weth].decimals - 10],
      101234567890n * BI_POWS[tokens[weth].decimals - 11],
    ];

    const amountsUSDC = [
      0n,
      100n * BI_POWS[tokens[usdc].decimals],
      200n * BI_POWS[tokens[usdc].decimals],
      300n * BI_POWS[tokens[usdc].decimals],
      400n * BI_POWS[tokens[usdc].decimals],
      500n * BI_POWS[tokens[usdc].decimals],
      600n * BI_POWS[tokens[usdc].decimals],
      7001n * BI_POWS[tokens[usdc].decimals - 1],
      80012n * BI_POWS[tokens[usdc].decimals - 2],
      900123n * BI_POWS[tokens[usdc].decimals - 3],
      10001234n * BI_POWS[tokens[usdc].decimals - 4],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      lighterV2 = new LighterV2(network, dexKey, dexHelper);
      if (lighterV2.initializePricing) {
        await lighterV2.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL WETH for USDC', async function () {
      await testPricingOnNetwork(
        lighterV2,
        network,
        dexKey,
        blockNumber,
        weth,
        usdc,
        SwapSide.SELL,
        amountsWETH,
      );
    });
    it('getPoolIdentifiers and getPricesVolume SELL USDC for WETH', async function () {
      await testPricingOnNetwork(
        lighterV2,
        network,
        dexKey,
        blockNumber,
        usdc,
        weth,
        SwapSide.SELL,
        amountsUSDC,
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY USDC with WETH', async function () {
      await testPricingOnNetwork(
        lighterV2,
        network,
        dexKey,
        blockNumber,
        weth,
        usdc,
        SwapSide.BUY,
        amountsUSDC,
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY WETH with USDC', async function () {
      await testPricingOnNetwork(
        lighterV2,
        network,
        dexKey,
        blockNumber,
        usdc,
        weth,
        SwapSide.BUY,
        amountsWETH,
      );
    });

    describe('getTopPoolsForToken', () => {
      let newLighterV2: LighterV2;

      beforeAll(async () => {
        // We have to check without calling initializePricing, because
        // pool-tracker is not calling that function
        newLighterV2 = new LighterV2(network, dexKey, dexHelper);
        if (newLighterV2.updatePoolState) {
          await newLighterV2.updatePoolState();
        }
      });

      for (const token of [weth, usdc]) {
        it(`getTopPoolsForToken ${token}`, async function () {
          const poolLiquidity = await newLighterV2.getTopPoolsForToken(
            tokens[token].address,
            10,
          );
          console.log(`${token} Top Pools:`, poolLiquidity);

          if (!newLighterV2.hasConstantPriceLargeAmounts) {
            checkPoolsLiquidity(
              poolLiquidity,
              Tokens[network][token].address,
              dexKey,
            );
          }
        });
      }
    });
  });
});
