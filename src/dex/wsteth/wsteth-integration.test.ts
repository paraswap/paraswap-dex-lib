import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { WstETH } from './wsteth';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
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
  wstETH: WstETH,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
) {
  const exchangeAddress = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0';

  const readerIface = WstETH.wstETHIface;

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
  );
  const readerResult = (
    await wstETH.dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

async function testPricingOnNetwork(
  wstETH: WstETH,
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

  const pools = await wstETH.getPoolIdentifiers(
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

  const poolPrices = await wstETH.getPricesVolume(
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
  checkPoolPrices(poolPrices!, amounts, side, dexKey);

  // Check if onchain pricing equals to calculated ones
  await checkOnChainPricing(
    wstETH,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
  );
}

describe('wstETH', function () {
  const dexKey = 'wstETH';
  let blockNumber: number;
  let wstETH: WstETH;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const stETHTokenSymbol = 'STETH';
    const wstETHTokenSymbol = 'wstETH';

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
      wstETH = new WstETH(network, dexKey, dexHelper);
      //if (wstETH.initializePricing) {
      //  await wstETH.initializePricing(blockNumber);
      //}
    });

    it('getPoolIdentifiers and getPricesVolume SELL wstETH->stETH', async function () {
      await testPricingOnNetwork(
        wstETH,
        network,
        dexKey,
        blockNumber,
        wstETHTokenSymbol,
        stETHTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        'getStETHByWstETH',
      );
    });

    it('getPoolIdentifiers and getPricesVolume SELL stETH->wstETH', async function () {
      await testPricingOnNetwork(
        wstETH,
        network,
        dexKey,
        blockNumber,
        stETHTokenSymbol,
        wstETHTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        'getWstETHByStETH',
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newWstETH = new WstETH(network, dexKey, dexHelper);
      //if (newWstETH.updatePoolState) {
      //  await newWstETH.updatePoolState();
      //}
      const poolLiquidity = await newWstETH.getTopPoolsForToken(
        tokens[stETHTokenSymbol].address,
        10,
      );
      console.log(`${stETHTokenSymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(
        poolLiquidity,
        Tokens[network][stETHTokenSymbol].address,
        dexKey,
      );
    });
  });
});
