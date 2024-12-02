/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, NULL_ADDRESS, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { BalancerV3 } from './balancer-v3';
import {
  checkPoolPrices,
  checkConstantPoolPrices,
  checkPoolsLiquidity,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { BalancerV3Config } from './config';
import { BalancerV3Data, Step } from './types';
import { Address, ExchangePrices, PoolPrices } from '../../types';
import balancerBatchRouterAbi from '../../abi/balancer-v3/batch-router.json';
import balancerRouterAbi from '../../abi/balancer-v3/router.json';

function getQuerySwapSingleTokenCalldata(
  routerAddress: Address,
  routerInterface: Interface,
  amounts: bigint[],
  step: Step,
  side: SwapSide,
) {
  return amounts
    .filter(amount => amount !== 0n)
    .map(amount => {
      return {
        target: routerAddress,
        callData: routerInterface.encodeFunctionData(
          side === SwapSide.SELL
            ? `querySwapSingleTokenExactIn`
            : `querySwapSingleTokenExactOut`,
          [
            step.pool,
            step.swapInput.tokenIn,
            step.swapInput.tokenOut,
            amount,
            NULL_ADDRESS,
            '0x',
          ],
        ),
      };
    });
}

function getQuerySwapMultiTokenCalldata(
  routerAddress: Address,
  routerInterface: Interface,
  amounts: bigint[],
  steps: Step[],
  side: SwapSide,
) {
  const tokenIn = steps[0].swapInput.tokenIn;
  const stepsNew = steps.map(s => ({
    pool: s.pool,
    tokenOut: s.tokenOut,
    isBuffer: s.isBuffer,
  }));
  return amounts
    .filter(amount => amount !== 0n)
    .map(amount => {
      let args: any[] = [];
      if (side === SwapSide.SELL)
        args = [
          {
            tokenIn,
            steps: stepsNew,
            exactAmountIn: amount,
            minAmountOut: 0n,
          },
        ];
      else
        args = [
          {
            tokenIn,
            steps: stepsNew,
            exactAmountOut: amount,
            maxAmountIn: 0n,
          },
        ];
      return {
        target: routerAddress,
        callData: routerInterface.encodeFunctionData(
          side === SwapSide.SELL ? `querySwapExactIn` : `querySwapExactOut`,
          [args, NULL_ADDRESS, '0x'],
        ),
      };
    });
}

async function querySinglePathPrices(
  network: number,
  side: SwapSide,
  balancerV3: BalancerV3,
  blockNumber: number,
  price: PoolPrices<BalancerV3Data>,
  amounts: bigint[],
) {
  const balancerRouter = new Interface(balancerRouterAbi);
  const readerCallData = getQuerySwapSingleTokenCalldata(
    BalancerV3Config.BalancerV3[network].balancerRouterAddress,
    balancerRouter,
    amounts,
    price.data.steps[0],
    side,
  );

  const expectedPrices = [0n];
  for (const call of readerCallData) {
    const result = await balancerV3.dexHelper.provider.call(
      {
        to: call.target,
        data: call.callData,
      },
      blockNumber,
    );
    const parsed = balancerRouter.decodeFunctionResult(
      side === SwapSide.SELL
        ? `querySwapSingleTokenExactIn`
        : `querySwapSingleTokenExactOut`,
      result,
    );
    expectedPrices.push(BigInt(parsed[0]._hex));
  }
  return expectedPrices;
}

async function queryMultiPathPrices(
  network: number,
  side: SwapSide,
  balancerV3: BalancerV3,
  blockNumber: number,
  price: PoolPrices<BalancerV3Data>,
  amounts: bigint[],
) {
  const balancerBatchRouter = new Interface(balancerBatchRouterAbi);
  const readerCallData = getQuerySwapMultiTokenCalldata(
    BalancerV3Config.BalancerV3[network].balancerBatchRouterAddress,
    balancerBatchRouter,
    amounts,
    price.data.steps,
    side,
  );

  const expectedPrices = [0n];
  for (const call of readerCallData) {
    const result = await balancerV3.dexHelper.provider.call(
      {
        to: call.target,
        data: call.callData,
      },
      blockNumber,
    );
    const parsed = balancerBatchRouter.decodeFunctionResult(
      side === SwapSide.SELL ? `querySwapExactIn` : `querySwapExactOut`,
      result,
    );
    expectedPrices.push(BigInt(parsed[2][0]._hex));
  }
  return expectedPrices;
}

// Note - this is currently needed because queries won't work with multicall but should be updated in future
async function checkOnChainPricingNonMulti(
  network: number,
  side: SwapSide,
  balancerV3: BalancerV3,
  blockNumber: number,
  prices: ExchangePrices<BalancerV3Data>,
  amounts: bigint[],
) {
  // test match for each returned price
  for (const price of prices) {
    let expectedPrices: bigint[] = [];
    if (price.data.steps.length === 1)
      expectedPrices = await querySinglePathPrices(
        network,
        side,
        balancerV3,
        blockNumber,
        price,
        amounts,
      );
    else
      expectedPrices = await queryMultiPathPrices(
        network,
        side,
        balancerV3,
        blockNumber,
        price,
        amounts,
      );
    expect(price.prices).toEqual(expectedPrices);
  }
}

async function testPricingOnNetwork(
  balancerV3: BalancerV3,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
) {
  const networkTokens = Tokens[network];

  const pools = await balancerV3.getPoolIdentifiers(
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

  const poolPrices = await balancerV3.getPricesVolume(
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
  if (balancerV3.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey, false);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricingNonMulti(
    network,
    side,
    balancerV3,
    blockNumber,
    poolPrices!,
    amounts,
  );
}

describe('BalancerV3', function () {
  const dexKey = 'BalancerV3';
  let blockNumber: number;
  let balancerV3: BalancerV3;

  describe('Weighted Pool', () => {
    const network = Network.SEPOLIA;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];
    const srcTokenSymbol = 'bal';
    const destTokenSymbol = 'daiAave';

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
      balancerV3 = new BalancerV3(network, dexKey, dexHelper);
      if (balancerV3.initializePricing) {
        await balancerV3.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        balancerV3,
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
        balancerV3,
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
      const newBalancerV3 = new BalancerV3(network, dexKey, dexHelper);
      if (newBalancerV3.updatePoolState) {
        await newBalancerV3.updatePoolState();
      }
      const poolLiquidity = await newBalancerV3.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newBalancerV3.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });

  describe('Stable Pool', () => {
    const network = Network.SEPOLIA;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];
    const srcTokenSymbol = 'stataUsdc';
    const destTokenSymbol = 'stataUsdt';

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
      balancerV3 = new BalancerV3(network, dexKey, dexHelper);
      if (balancerV3.initializePricing) {
        await balancerV3.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        balancerV3,
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
        balancerV3,
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
      const newBalancerV3 = new BalancerV3(network, dexKey, dexHelper);
      if (newBalancerV3.updatePoolState) {
        await newBalancerV3.updatePoolState();
      }
      const poolLiquidity = await newBalancerV3.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newBalancerV3.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });

  describe('Boosted Path', () => {
    const network = Network.SEPOLIA;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];
    const srcTokenSymbol = 'usdcAave';
    const destTokenSymbol = 'usdtAave';

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
      balancerV3 = new BalancerV3(network, dexKey, dexHelper);
      if (balancerV3.initializePricing) {
        await balancerV3.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        balancerV3,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
      );
    });

    // TODO 1 WEI rounding issue in maths - investigating
    it.skip('getPoolIdentifiers and getPricesVolume BUY', async function () {
      await testPricingOnNetwork(
        balancerV3,
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
      const newBalancerV3 = new BalancerV3(network, dexKey, dexHelper);
      if (newBalancerV3.updatePoolState) {
        await newBalancerV3.updatePoolState();
      }
      const poolLiquidity = await newBalancerV3.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newBalancerV3.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});

// Add back once multicall queries are working
/*
function decodeQuerySwapSingleTokenResult(results: Result, side: SwapSide) {
  const balancerRouter = new Interface(balancerRouterAbi);
  return results.map(result => {
    const parsed = balancerRouter.decodeFunctionResult(
      side === SwapSide.SELL
        ? `querySwapSingleTokenExactIn`
        : `querySwapSingleTokenExactOut`,
      result,
    );
    return BigInt(parsed[0]._hex);
  });
}

async function checkOnChainPricing(
  network: number,
  side: SwapSide,
  balancerV3: BalancerV3,
  blockNumber: number,
  prices: ExchangePrices<BalancerV3Data>,
  amounts: bigint[],
) {
  // test match for each returned price
  for (const price of prices) {
    const readerCallData = getQuerySwapSingleTokenCalldata(
      network,
      amounts,
      price.data.steps[0],
      side,
    );
    const readerResult = (
      await balancerV3.dexHelper.multiContract.methods
        .aggregate(readerCallData)
        .call({}, blockNumber)
    ).returnData;
    const expectedPrices = [0n].concat(
      decodeQuerySwapSingleTokenResult(readerResult, side),
    );
    expect(price.prices).toEqual(expectedPrices);
  }
}
  */
