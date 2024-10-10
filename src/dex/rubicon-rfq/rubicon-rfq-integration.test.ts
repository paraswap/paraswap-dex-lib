/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { RubiconRfq } from './rubicon-rfq';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
  sleep,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

async function testPricingOnNetwork(
  rubiconRfq: RubiconRfq,
  network: Network,
  dexKey: string,
  blockNumber: number,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
) {
  const networkTokens = Tokens[network];

  const pools = await rubiconRfq.getPoolIdentifiers(
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

  const poolPrices = await rubiconRfq.getPricesVolume(
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
  if (rubiconRfq.hasConstantPriceLargeAmounts) {
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  } else {
    checkPoolPrices(poolPrices!, amounts, side, dexKey);
  }
}

describe('RubiconRfq', function () {
  const dexKey = 'RubiconRfq';
  let blockNumber: number;
  let rubiconRfq: RubiconRfq;

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'WETH';
    const destTokenSymbol = 'USDC';

    // Test with small amounts.
    const amountsForSell = [
      0n,
      1n * BI_POWS[tokens[srcTokenSymbol].decimals - 2],
      2n * BI_POWS[tokens[srcTokenSymbol].decimals - 2],
      3n * BI_POWS[tokens[srcTokenSymbol].decimals - 2],
      4n * BI_POWS[tokens[srcTokenSymbol].decimals - 2],
      5n * BI_POWS[tokens[srcTokenSymbol].decimals - 2],
      6n * BI_POWS[tokens[srcTokenSymbol].decimals - 2],
      7n * BI_POWS[tokens[srcTokenSymbol].decimals - 2],
      8n * BI_POWS[tokens[srcTokenSymbol].decimals - 2],
      9n * BI_POWS[tokens[srcTokenSymbol].decimals - 2],
      10n * BI_POWS[tokens[srcTokenSymbol].decimals - 2],
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
      rubiconRfq = new RubiconRfq(network, dexKey, dexHelper);
      if (rubiconRfq.initializePricing) {
        await rubiconRfq.initializePricing(blockNumber);
        await sleep(5000);
      }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        rubiconRfq,
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
        rubiconRfq,
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
      const newRubiconRfq = new RubiconRfq(network, dexKey, dexHelper);
      const poolLiquidity = await newRubiconRfq.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      if (!newRubiconRfq.hasConstantPriceLargeAmounts) {
        checkPoolsLiquidity(
          poolLiquidity,
          Tokens[network][srcTokenSymbol].address,
          dexKey,
        );
      }
    });
  });
});
