/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { LighterV1 } from './lighter-v1';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { ethers } from 'ethers';

async function getQuoteFromHelper(
  lighterV1: LighterV1,
  blockNumber: number,
  orderBookId: number,
  amountIn: bigint,
  isAsk: boolean,
): Promise<bigint> {
  const helper = new ethers.Contract(
    lighterV1.config.orderBookHelper,
    lighterV1.orderBookHelperIface,
  );

  const data = await lighterV1.dexHelper.provider.call(
    {
      to: helper.address,
      data: helper.interface.encodeFunctionData('quoteExactInput', [
        orderBookId,
        isAsk,
        amountIn,
      ]),
    },
    blockNumber,
  );

  const [_, amountOut] = helper.interface.decodeFunctionResult(
    'quoteExactInput',
    data,
  );

  return amountOut;
}

async function testPricingOnNetwork(
  lighterV1: LighterV1,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
) {
  const networkTokens = Tokens[network];

  const pools = await lighterV1.getPoolIdentifiers(
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

  const poolPrices = await lighterV1.getPricesVolume(
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

  const key = pools[0].split('_')[1];

  const orderBookType = lighterV1.allSupportedOrderBooks.get(key);

  const expectedPrices: bigint[] = [];

  for (let i = 0; i < amounts.length; i++) {
    const amount = amounts[i];
    const price = await getQuoteFromHelper(
      lighterV1,
      blockNumber,
      orderBookType!.orderBookId,
      amount,
      orderBookType!.isAsk,
    );
    expectedPrices.push(price);
  }

  expect(poolPrices).not.toBeNull();
  if (lighterV1.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, expectedPrices, dexKey);
  } else {
    checkPoolPrices(poolPrices!, expectedPrices, side, dexKey);
  }
}

describe('LighterV1', function () {
  const dexKey = 'LighterV1';
  let blockNumber: number;
  let lighterV1: LighterV1;

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'WETH';
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

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      lighterV1 = new LighterV1(network, dexKey, dexHelper);
      if (lighterV1.initializePricing) {
        await lighterV1.initializePricing(blockNumber);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        lighterV1,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newLighterV1 = new LighterV1(network, dexKey, dexHelper);
      if (newLighterV1.updatePoolState) {
        await newLighterV1.updatePoolState();
      }
      const poolLiquidity = await newLighterV1.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newLighterV1.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
