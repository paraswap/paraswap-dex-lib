/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { ConcentratorArusd } from './concentrator-arusd';
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
    callData: readerIface.encodeFunctionData(funcName, []),
  }));
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
  destTokenSymbol: string,
  amounts: bigint[],
) {
  return results.map((result, index) => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    return BigInt(parsed[0]._hex) * BigInt(amounts[index + 1] / BI_POWS[18]);
  });
}

async function checkOnChainPricing(
  concentratorArusd: ConcentratorArusd,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  destTokenSymbol: string,
) {
  const exchangeAddress = '0x65D72AA8DA931F047169112fcf34f52DbaAE7D18';

  // Normally you can get it from concentratorArusd.Iface or from eventPool.
  // It depends on your implementation
  const readerIface = ConcentratorArusd.arUSDIface;
  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
  );
  const readerResult = (
    await concentratorArusd.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(
      readerResult,
      readerIface,
      funcName,
      destTokenSymbol,
      amounts,
    ),
  );
  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  concentratorArusd: ConcentratorArusd,
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
  const pools = await concentratorArusd.getPoolIdentifiers(
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

  const poolPrices = await concentratorArusd.getPricesVolume(
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

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    concentratorArusd,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
    destTokenSymbol,
  );
}

describe('ConcentratorArusd', function () {
  const dexKey = 'ConcentratorArusd';
  let blockNumber: number;
  let concentratorArusd: ConcentratorArusd;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // Don't forget to update relevant tokens in constant-e2e.ts
    const srcTokenSymbol_rUSD = 'rUSD';
    const destTokenSymbol_arUSD = 'arUSD';

    const srcTokenSymbol_arUSD = 'arUSD';
    const destTokenSymbol_rUSD = 'rUSD';

    const destTokenSymbol_weETH = 'weETH';

    const amountsForSell = [
      0n,
      1n * BI_POWS[18],
      2n * BI_POWS[18],
      3n * BI_POWS[18],
      4n * BI_POWS[18],
      5n * BI_POWS[18],
      6n * BI_POWS[18],
      7n * BI_POWS[18],
      8n * BI_POWS[18],
      9n * BI_POWS[18],
      10n * BI_POWS[18],
    ];

    beforeAll(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      concentratorArusd = new ConcentratorArusd(network, dexKey, dexHelper);
    });

    it('getPoolIdentifiers and getRUSDPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        concentratorArusd,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol_rUSD,
        destTokenSymbol_arUSD,
        SwapSide.SELL,
        amountsForSell,
        'nav',
      );
    });

    it('getPoolIdentifiers and getARUSDPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        concentratorArusd,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol_arUSD,
        destTokenSymbol_rUSD,
        SwapSide.SELL,
        amountsForSell,
        'nav',
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newConcentratorArusd = new ConcentratorArusd(
        network,
        dexKey,
        dexHelper,
      );
      const poolLiquidity = await newConcentratorArusd.getTopPoolsForToken(
        tokens[srcTokenSymbol_arUSD].address,
        10,
      );
      console.log(`${srcTokenSymbol_arUSD} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(
        poolLiquidity,
        Tokens[network][srcTokenSymbol_arUSD].address,
        dexKey,
      );
    });
  });
});
