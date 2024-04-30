/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { PoolPrices, Address } from '../../types';
import { BI_MAX_UINT256, BI_POWS } from '../../bigint-constants';
import { VirtuSwap } from './virtuswap';
import { VirtuSwapData } from './types';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

jest.setTimeout(50 * 1000);

function getReaderCalldata(
  routerAddress: Address,
  readerIface: Interface,
  address1: Address,
  address2: Address,
  amounts: bigint[],
  funcName: string,
) {
  return amounts.map(amount => ({
    target: routerAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      address1,
      address2,
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
  virtuswap: VirtuSwap,
  realFuncName: string,
  virtualFuncName: string,
  blockNumber: number,
  poolPrices: PoolPrices<VirtuSwapData>[],
  amounts: bigint[],
) {
  const readerIface = virtuswap.vRouterIface;
  const routerAddress = virtuswap.routerAddress;

  for (const prices of poolPrices) {
    let address1: Address;
    let address2: Address;
    if (prices.data.isVirtual) {
      address1 = virtuswap.computePoolAddress({
        token0: prices.data.tokenOut,
        token1: prices.data.commonToken,
      });
      address2 = prices.data.ikPair;
    } else {
      address1 = prices.data.path[0];
      address2 = prices.data.path[1];
    }

    const funcName = prices.data.isVirtual ? virtualFuncName : realFuncName;

    const readerCallData = getReaderCalldata(
      routerAddress,
      readerIface,
      address1,
      address2,
      amounts.slice(1),
      funcName,
    );

    const readerResult = (
      await virtuswap.dexHelper.multiContract.methods
        .aggregate(readerCallData)
        .call({}, blockNumber)
    ).returnData;

    const expectedPrices = [0n].concat(
      decodeReaderResult(readerResult, readerIface, funcName),
    );

    expect(prices.prices).toEqual(expectedPrices);
  }
}

async function testPricingOnNetwork(
  virtuswap: VirtuSwap,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
  realFuncNameToCheck: string,
  virtualFuncNameToCheck: string,
) {
  const networkTokens = Tokens[network];

  const pools = await virtuswap.getPoolIdentifiers(
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

  const poolPrices = await virtuswap.getPricesVolume(
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

  const pricesToCheck = poolPrices!.filter(
    ({ prices }) =>
      prices[prices.length - 1] !== BI_MAX_UINT256 &&
      prices[prices.length - 1] !== 0n,
  );

  expect(pricesToCheck.length).toBeGreaterThan(0);

  // some virtual pools can have very low liquidity and should be skipped from the check
  const skippedPrices = poolPrices!.filter(
    ({ prices }) =>
      prices[prices.length - 1] === BI_MAX_UINT256 ||
      prices[prices.length - 1] === 0n,
  );
  if (skippedPrices.length > 0)
    console.warn(
      `Some pools had very low liquidity. Skipped Prices: `,
      skippedPrices,
    );

  if (virtuswap.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(pricesToCheck!, amounts, dexKey);
  } else {
    checkPoolPrices(pricesToCheck!, amounts, side, dexKey);
  }

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    virtuswap,
    realFuncNameToCheck,
    virtualFuncNameToCheck,
    blockNumber,
    pricesToCheck!,
    amounts,
  );
}

describe('VirtuSwap', function () {
  const dexKey = 'VirtuSwap';
  const networks = [Network.POLYGON, Network.ARBITRUM];
  let blockNumber: number;
  let virtuswap: VirtuSwap;

  for (const network of networks) {
    describe(`Network id: ${network}`, () => {
      const dexHelper = new DummyDexHelper(network);

      const tokens = Tokens[network];

      const srcTokenSymbol = tokens['USDCe'] ? 'USDCe' : 'USDC';
      const destTokenSymbol = 'VRSW';

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
        virtuswap = new VirtuSwap(network, dexKey, dexHelper);
        if (virtuswap.initializePricing) {
          await virtuswap.initializePricing(blockNumber);
        }
      });

      it('getPoolIdentifiers and getPricesVolume SELL', async function () {
        await testPricingOnNetwork(
          virtuswap,
          network,
          dexKey,
          blockNumber,
          srcTokenSymbol,
          destTokenSymbol,
          SwapSide.SELL,
          amountsForSell,
          'getAmountOut',
          'getVirtualAmountOut',
        );
      });

      it('getPoolIdentifiers and getPricesVolume BUY', async function () {
        await testPricingOnNetwork(
          virtuswap,
          network,
          dexKey,
          blockNumber,
          srcTokenSymbol,
          destTokenSymbol,
          SwapSide.BUY,
          amountsForBuy,
          'getAmountIn',
          'getVirtualAmountIn',
        );
      });

      // TODO: add subgraphURL to set up getTopPoolsForToken

      // it('getTopPoolsForToken', async function () {
      //   // We have to check without calling initializePricing, because
      //   // pool-tracker is not calling that function
      //   const newVirtuSwap = new VirtuSwap(network, dexKey, dexHelper);
      //   if (newVirtuSwap.updatePoolState) {
      //     await newVirtuSwap.updatePoolState();
      //   }
      //   const poolLiquidity = await newVirtuSwap.getTopPoolsForToken(
      //     tokens[srcTokenSymbol].address,
      //     10,
      //   );
      //   console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);
      //
      //   if (!newVirtuSwap.hasConstantPriceLargeAmounts) {
      //     checkPoolsLiquidity(
      //       poolLiquidity,
      //       Tokens[network][srcTokenSymbol].address,
      //       dexKey,
      //     );
      //   }
      // });
    });
  }
});
