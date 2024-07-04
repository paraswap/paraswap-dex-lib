/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { AaveV3Stata } from './aave-v3-stata';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

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
  aaveV3Stata: AaveV3Stata,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
) {
  const exchangeAddress = '0x2dca80061632f3f87c9ca28364d1d0c30cd79a19'; // stataUSDCn

  const readerIface = AaveV3Stata.stata;

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
  );
  const readerResult = (
    await aaveV3Stata.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  aaveV3Stata: AaveV3Stata,
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

  const pools = await aaveV3Stata.getPoolIdentifiers(
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

  const poolPrices = await aaveV3Stata.getPricesVolume(
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
  if (aaveV3Stata.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    aaveV3Stata,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
  );
}

describe('AaveV3Stata', function () {
  const dexKey = 'AaveV3Stata';
  let blockNumber: number;
  let aaveV3Stata: AaveV3Stata;

  describe('Polygon', () => {
    const network = Network.POLYGON;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'USDCn';
    const destTokenSymbol = 'stataUSDCn';

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
      aaveV3Stata = new AaveV3Stata(network, dexKey, dexHelper);
      if (aaveV3Stata.initializePricing) {
        await aaveV3Stata.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL USDCn -> stataUSDCn', async function () {
      await testPricingOnNetwork(
        aaveV3Stata,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        'previewDeposit',
      );
    });

    it('getPoolIdentifiers and getPricesVolume SELL stataUSDCn -> USDCn ', async function () {
      await testPricingOnNetwork(
        aaveV3Stata,
        network,
        dexKey,
        blockNumber,
        destTokenSymbol,
        srcTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        'previewRedeem',
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY USDC -> stataUSDCn', async function () {
      await testPricingOnNetwork(
        aaveV3Stata,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.BUY,
        amountsForBuy,
        'previewMint',
      );
    });

    it('getPoolIdentifiers and getPricesVolume BUY stataUSDCn -> USDC', async function () {
      await testPricingOnNetwork(
        aaveV3Stata,
        network,
        dexKey,
        blockNumber,
        destTokenSymbol,
        srcTokenSymbol,
        SwapSide.BUY,
        amountsForBuy,
        'previewWithdraw',
      );
    });

    it(`getTopPoolsForToken - ${srcTokenSymbol}`, async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newAaveV3Stata = new AaveV3Stata(network, dexKey, dexHelper);
      if (newAaveV3Stata.updatePoolState) {
        await newAaveV3Stata.updatePoolState();
      }
      const poolLiquidity = await newAaveV3Stata.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(
        `${srcTokenSymbol} Top Pools:`,
        JSON.stringify(poolLiquidity, null, 2),
      );

      if (!newAaveV3Stata.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });

    it(`getTopPoolsForToken - ${destTokenSymbol}`, async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newAaveV3Stata = new AaveV3Stata(network, dexKey, dexHelper);
      if (newAaveV3Stata.updatePoolState) {
        await newAaveV3Stata.updatePoolState();
      }
      const poolLiquidity = await newAaveV3Stata.getTopPoolsForToken(
        tokens[destTokenSymbol].address,
        10,
      );
      console.log(
        `${destTokenSymbol} Top Pools:`,
        JSON.stringify(poolLiquidity, null, 2),
      );

      if (!newAaveV3Stata.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][destTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
