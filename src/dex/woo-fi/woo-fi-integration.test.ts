import dotenv from 'dotenv';
dotenv.config();

import { Result, Interface } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { WooFi } from './woo-fi';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { Token } from '../../types';

const network = Network.BSC;
const TokenASymbol = 'WBNB';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'USDT';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [0n, BI_POWS[18], 2n * BI_POWS[18], 3n * BI_POWS[18]];

const dexKey = 'WooFi';
const dexHelper = new DummyDexHelper(network);

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  baseToken: Token,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      baseToken.address,
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
  wooFi: WooFi,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
) {
  const readerCallData = getReaderCalldata(
    wooFi.config.wooPPAddress,
    WooFi.ifaces.PP,
    amounts.slice(1),
    funcName,
    TokenA,
  );
  const readerResult = (
    await dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;
  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, WooFi.ifaces.PP, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

describe('WooFi', function () {
  let blockNumber: number;
  let wooFi: WooFi;

  beforeAll(async () => {
    blockNumber = await dexHelper.provider.getBlockNumber();

    wooFi = new WooFi(network, dexKey, dexHelper);
    await wooFi.initializePricing(blockNumber);

    console.log(`Current state for block number ${blockNumber} is:`);
    console.log(
      JSON.stringify(
        wooFi.latestState,
        (key, value) => (typeof value === 'bigint' ? value.toString() : value), // return everything else unchanged
      ),
    );
  });

  it('getPoolIdentifiers and getPricesVolume SELL Base', async function () {
    const pools = await wooFi.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await wooFi.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (wooFi.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    // Check if onchain pricing equals to calculated ones
    await checkOnChainPricing(
      wooFi,
      'querySellBase',
      blockNumber,
      poolPrices![0].prices,
    );
  });

  it('getPoolIdentifiers and getPricesVolume SELL Quote', async function () {
    const pools = await wooFi.getPoolIdentifiers(
      TokenB,
      TokenA,
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenBSymbol} <> ${TokenASymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await wooFi.getPricesVolume(
      TokenB,
      TokenA,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (wooFi.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    await checkOnChainPricing(
      wooFi,
      'querySellQuote',
      blockNumber,
      poolPrices![0].prices,
    );
  });

  it('getTopPoolsForToken Base', async function () {
    const poolLiquidity = await wooFi.getTopPoolsForToken(TokenA.address, 10);
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!wooFi.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });

  it('getTopPoolsForToken Quote', async function () {
    const poolLiquidity = await wooFi.getTopPoolsForToken(TokenB.address, 10);
    console.log(`${TokenBSymbol} Top Pools:`, poolLiquidity);

    if (!wooFi.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenB.address, dexKey);
    }
  });

  it('handle woo guardian unreliable price', async () => {
    // I found this test condition state only for Fantom
    const network = Network.FANTOM;
    const dexHelper = new DummyDexHelper(network);

    const blockNumber = 38145311;

    const wooFi = new WooFi(network, dexKey, dexHelper);
    await wooFi.initializePricing(blockNumber);

    const TokenASymbol = 'WFTM';
    const TokenBSymbol = 'USDC';

    const pools = await wooFi.getPoolIdentifiers(
      Tokens[network][TokenASymbol],
      Tokens[network][TokenBSymbol],
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await wooFi.getPricesVolume(
      Tokens[network][TokenASymbol],
      Tokens[network][TokenBSymbol],
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).toBeNull();

    const priceToTest =
      wooFi.latestState!.tokenStates[
        Tokens[network][TokenASymbol].address.toLowerCase()
      ].priceNow;

    expect(() =>
      wooFi.math.checkSwapPrice(
        priceToTest,
        Tokens[network][TokenASymbol].address.toLowerCase(),
        wooFi.quoteTokenAddress,
      ),
    ).toThrowError(
      'WooGuardian: PRICE_UNRELIABLE in checkSwapPrice fromToken=0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83 and toToken=0x04068da6c83afcfa0e13ba15a6696662335d5b75',
    );
  });
});
