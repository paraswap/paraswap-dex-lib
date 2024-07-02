/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { FxProtocolRusd } from './fx-protocol-rusd';
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
  fxProtocol: FxProtocolRusd,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  destTokenSymbol: string,
) {
  const exchangeAddress = '0x65D72AA8DA931F047169112fcf34f52DbaAE7D18';

  // Normally you can get it from fxProtocol.Iface or from eventPool.
  // It depends on your implementation
  const readerIface = FxProtocolRusd.fxUSDIface;
  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
  );
  const readerResult = (
    await fxProtocol.dexHelper.multiContract.methods
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
  fxProtocol: FxProtocolRusd,
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
  const pools = await fxProtocol.getPoolIdentifiers(
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

  const poolPrices = await fxProtocol.getPricesVolume(
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
    fxProtocol,
    funcNameToCheck,
    blockNumber,
    poolPrices![0].prices,
    amounts,
    destTokenSymbol,
  );
}

describe('FxProtocolRusd', function () {
  const dexKey = 'FxProtocolRusd';
  let blockNumber: number;
  let fxProtocol: FxProtocolRusd;

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    // Don't forget to update relevant tokens in constant-e2e.ts
    const srcTokenSymbol = 'weETH';
    const destTokenSymbol = 'rUSD';

    const srcTokenSymbol_rUSD = 'rUSD';
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
      fxProtocol = new FxProtocolRusd(network, dexKey, dexHelper);
      // if (fxProtocol.initializePricing) {
      //   await fxProtocol.initializePricing(blockNumber);
      // }
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        fxProtocol,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol,
        destTokenSymbol,
        SwapSide.SELL,
        amountsForSell,
        'nav',
      );
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      await testPricingOnNetwork(
        fxProtocol,
        network,
        dexKey,
        blockNumber,
        srcTokenSymbol_rUSD,
        destTokenSymbol_weETH,
        SwapSide.SELL,
        amountsForSell,
        'nav',
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newFxProtocol = new FxProtocolRusd(network, dexKey, dexHelper);
      // if (newFxProtocol.updatePoolState) {
      //   await newFxProtocol.updatePoolState();
      // }
      const poolLiquidity = await newFxProtocol.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      // if (!newFxProtocol.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(
        poolLiquidity,
        Tokens[network][srcTokenSymbol].address,
        dexKey,
      );
      // }
    });
  });
});
