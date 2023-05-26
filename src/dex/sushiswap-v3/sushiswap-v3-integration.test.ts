/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { SushiswapV3 } from './sushiswap-v3';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { Address } from '../../types';
import {
  QuoteExactInputSingleParams,
  QuoteExactOutputSingleParams,
} from './types';

function getQuoterV2Params(
  funcName: string,
  tokenIn: Address,
  tokenOut: Address,
  amount: bigint,
  fee: bigint,
): QuoteExactInputSingleParams | QuoteExactOutputSingleParams {
  return funcName === 'quoteExactInputSingle'
    ? { tokenIn, tokenOut, fee, sqrtPriceLimitX96: 0n, amountIn: amount }
    : { tokenIn, tokenOut, fee, sqrtPriceLimitX96: 0n, amount };
}

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  tokenIn: Address,
  tokenOut: Address,
  fee: bigint,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      getQuoterV2Params(funcName, tokenIn, tokenOut, amount, fee),
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
  sushiswapV3: SushiswapV3,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  tokenIn: Address,
  tokenOut: Address,
  fee: bigint,
  amounts: bigint[],
) {
  const quoterAddress = sushiswapV3.config.quoter;
  const readerIface = sushiswapV3.quoterIface;

  const sum = prices.reduce((acc, curr) => (acc += curr), 0n);

  if (sum === 0n) {
    console.log(
      `Prices were not calculated for tokenIn=${tokenIn}, tokenOut=${tokenOut}, fee=${fee.toString()}. Most likely price impact is too big for requested amount`,
    );
    return false;
  }

  const readerCallData = getReaderCalldata(
    quoterAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    tokenIn,
    tokenOut,
    fee,
  );

  let readerResult;
  try {
    readerResult = (
      await sushiswapV3.dexHelper.multiContract.methods
        .aggregate(readerCallData)
        .call({}, blockNumber)
    ).returnData;
  } catch (e) {
    console.log(
      `Can not fetch on-chain pricing for fee ${fee}. It happens for low liquidity pools`,
      e,
    );
    return false;
  }

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  let firstZeroIndex = prices.slice(1).indexOf(0n);

  // we skipped first, so add +1 on result
  firstZeroIndex = firstZeroIndex === -1 ? prices.length : firstZeroIndex;

  // Compare only the ones for which we were able to calculate prices
  expect(prices.slice(0, firstZeroIndex)).toEqual(
    expectedPrices.slice(0, firstZeroIndex),
  );
  return true;
}

async function testPricingOnNetwork(
  sushiswapV3: SushiswapV3,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
) {
  const networkTokens = Tokens[network];

  const pools = await sushiswapV3.getPoolIdentifiers(
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

  const poolPrices = await sushiswapV3.getPricesVolume(
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
  checkPoolPrices(
    poolPrices!.filter(poolPrice =>
      poolPrice.prices.slice(1).every(price => price > 0),
    ),
    amounts,
    side,
    dexKey,
  );

  // Check if onchain pricing equals to calculated ones
  let falseChecksCounter = 0;
  await Promise.all(
    poolPrices!.map(async price => {
      const fee = sushiswapV3.eventPools[price.poolIdentifier!]!.feeCode;
      const res = await checkOnChainPricing(
        sushiswapV3,
        side === SwapSide.SELL
          ? 'quoteExactInputSingle'
          : 'quoteExactOutputSingle',
        blockNumber,
        price.prices,
        networkTokens[srcTokenSymbol].address,
        networkTokens[destTokenSymbol].address,
        fee,
        amounts,
      );
      if (res === false) falseChecksCounter++;
    }),
  );
  expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
}

describe('SushiswapV3', function () {
  const dexKey = 'SushiswapV3';
  let blockNumber: number;
  let sushiswapV3: SushiswapV3;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'USDC';
    const destTokenSymbol = 'WETH';

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
      1n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      2n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      3n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      4n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      5n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      6n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      7n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      8n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      9n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      10n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      sushiswapV3 = new SushiswapV3(network, dexKey, dexHelper);
      if (sushiswapV3.initializePricing) {
        await sushiswapV3.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        sushiswapV3,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      await testPricingOnNetwork(
        sushiswapV3,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.BUY,
        amountsForBuy,
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newSushiswapV3 = new SushiswapV3(network, dexKey, dexHelper);
      const poolLiquidity = await newSushiswapV3.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newSushiswapV3.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'USDC';
    const destTokenSymbol = 'WETH';

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
      1n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      2n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      3n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      4n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      5n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      6n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      7n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      8n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      9n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
      10n * BI_POWS[tokens[destTokenSymbol].decimals - 2],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      sushiswapV3 = new SushiswapV3(network, dexKey, dexHelper);
      if (sushiswapV3.initializePricing) {
        await sushiswapV3.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        sushiswapV3,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      await testPricingOnNetwork(
        sushiswapV3,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.BUY,
        amountsForBuy,
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newSushiswapV3 = new SushiswapV3(network, dexKey, dexHelper);
      const poolLiquidity = await newSushiswapV3.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newSushiswapV3.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
