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
import { getBigNumberPow } from '../../bignumber-constants';

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  fxProtocol: FxProtocolRusd,
  srcTokenSymbol: string,
  destTokenSymbol: string,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData('nav', []),
  }));
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
  fxProtocol: FxProtocolRusd,
  srcTokenSymbol: string,
  destTokenSymbol: string,
  amounts: bigint[],
  rUSDUsdPrice: number,
  weETHUsdPrice: number,
) {
  const _fxConfig = fxProtocol.getConfig();
  if (srcTokenSymbol == _fxConfig.weETHAddress) {
    return results.map((result, index) => {
      const parsed = readerIface.decodeFunctionResult('nav', result);
      return (
        (BigInt(weETHUsdPrice) *
          BigInt(amounts[index + 1] / BigInt(parsed[0]._hex))) /
        BI_POWS[18]
      );
    });
  }
  return results.map((result, index) => {
    const parsed = readerIface.decodeFunctionResult('nav', result);
    return (
      (BigInt(parsed[0]._hex) / BigInt(weETHUsdPrice)) *
      BigInt(amounts[index + 1] / BI_POWS[18])
    );
  });
}

async function checkOnChainPricing(
  fxProtocol: FxProtocolRusd,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  amounts: bigint[],
  srcTokenSymbol: string,
  destTokenSymbol: string,
  rUSDUsdPrice: number,
  weETHUsdPrice: number,
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
    fxProtocol,
    srcTokenSymbol,
    destTokenSymbol,
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
      fxProtocol,
      srcTokenSymbol,
      destTokenSymbol,
      amounts,
      rUSDUsdPrice,
      weETHUsdPrice,
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
  rUSDUsdPrice: number,
  weETHUsdPrice: number,
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
    srcTokenSymbol,
    destTokenSymbol,
    rUSDUsdPrice,
    weETHUsdPrice,
  );
}

describe('FxProtocolRusd', function () {
  const dexKey = 'FxProtocolRusd';
  let blockNumber: number;
  let fxProtocol: FxProtocolRusd;
  let rUSDUsdPrice: number;
  let weETHUsdPrice: number;

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
      rUSDUsdPrice = await fxProtocol.dexHelper.getTokenUSDPrice(
        tokens[srcTokenSymbol_rUSD],
        BigInt(
          getBigNumberPow(tokens[srcTokenSymbol_rUSD].decimals).toFixed(0),
        ),
      );
      weETHUsdPrice = await fxProtocol.dexHelper.getTokenUSDPrice(
        tokens[destTokenSymbol_weETH],
        BigInt(
          getBigNumberPow(tokens[destTokenSymbol_weETH].decimals).toFixed(0),
        ),
      );
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
        rUSDUsdPrice,
        weETHUsdPrice,
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
        rUSDUsdPrice,
        weETHUsdPrice,
      );
    });

    it('getTopPoolsForToken', async function () {
      // We have to check without calling initializePricing, because
      // pool-tracker is not calling that function
      const newFxProtocol = new FxProtocolRusd(network, dexKey, dexHelper);
      const poolLiquidity = await newFxProtocol.getTopPoolsForToken(
        tokens[srcTokenSymbol].address,
        10,
      );
      console.log(`${srcTokenSymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(
        poolLiquidity,
        Tokens[network][srcTokenSymbol].address,
        dexKey,
      );
    });
  });
});
