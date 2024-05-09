/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { MaverickV2 } from './maverick-v2';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { MaverickV2Data } from './types';
import { ExchangePrices, PoolPrices } from '../../types';
import MaverickV2QuoterABI from '../../abi/maverick-v2/MaverickV2Quoter.json';
import { MaverickV2Config } from './config';
import { AbiItem } from 'web3-utils';

/*
  README
  ======

  This test script adds tests for MaverickV2 general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover MaverickV2 specific
  logic.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-integration.test.ts`

  (This comment should be removed from the final implementation)
*/

const network = Network.BASE;
const dexKey = 'MaverickV2';
const dexHelper = new DummyDexHelper(network);

function calculateSwap(
  network: Network,
  pool: PoolPrices<MaverickV2Data>,
  blockNumber: number,
  poolAddress: string,
  srcToken: string,
  side: SwapSide,
  amount: bigint,
) {
  return new Promise(async (resolve, reject) => {
    let quoterContract = new dexHelper.web3Provider.eth.Contract(
      MaverickV2QuoterABI as AbiItem[],
      MaverickV2Config[dexKey][network].quoterAddress,
    );

    await quoterContract.methods
      .calculateSwap(
        poolAddress,
        amount,
        pool.data.tokenA.toLowerCase() == srcToken.toLowerCase(),
        side == SwapSide.BUY,
        pool.data.tokenA.toLowerCase() == srcToken.toLowerCase()
          ? 1000000n
          : -1000000n,
      )
      .call({}, blockNumber, (err: any, result: any) => {
        resolve(result);
      });
  });
}

async function checkOnChainPricing(
  maverickV2: MaverickV2,
  funcName: string,
  blockNumber: number,
  pools: ExchangePrices<MaverickV2Data>,
  amounts: bigint[],
  side: SwapSide,
  srcToken: string,
) {
  await Promise.all(
    pools.map(async pool => {
      const poolAddress = pool.data.pool;

      const results = await Promise.all(
        amounts.slice(1).map(async amount => {
          return calculateSwap(
            network,
            pool,
            blockNumber,
            poolAddress,
            srcToken,
            side,
            amount,
          );
        }),
      );

      const expectedPrices = [0n].concat(
        results.map((result: any) =>
          BigInt(side == SwapSide.SELL ? result.amountOut : result.amountIn),
        ),
      );

      expect(pool.prices).toEqual(expectedPrices);
    }),
  );
}

async function testPricingOnNetwork(
  maverickV2: MaverickV2,
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
  const pools = await maverickV2.getPoolIdentifiers(
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

  const poolPrices = await maverickV2.getPricesVolume(
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
  if (maverickV2.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    maverickV2,
    funcNameToCheck,
    blockNumber,
    poolPrices!,
    amounts,
    side,
    Tokens[network]['DAI'].address,
  );
}

describe('MaverickV2', function () {
  const dexKey = 'MaverickV2';
  let blockNumber: number;
  let maverickV2: MaverickV2;

  describe('Mainnet', () => {
    const network = Network.BASE;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // TODO: Put here token Symbol to check against
    // Don't forget to update relevant tokens in constant-e2e.ts
    const srcTokenSymbol = 'DAI';
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
      maverickV2 = new MaverickV2(network, dexKey, dexHelper);
      if (maverickV2.initializePricing) {
        await maverickV2.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        maverickV2,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        'calculatePrice', // TODO: Put here proper function name to check pricing
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      await testPricingOnNetwork(
        maverickV2,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.BUY,
        amountsForBuy,
        'calculatePrice', // TODO: Put here proper function name to check pricing
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newMaverickV2 = new MaverickV2(network, dexKey, dexHelper);
      if (newMaverickV2.updatePoolState) {
        await newMaverickV2.updatePoolState();
      }
      const poolLiquidity = await newMaverickV2.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newMaverickV2.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          tokens[srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
