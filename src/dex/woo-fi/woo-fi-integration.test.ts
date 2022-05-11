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
    wooFi.wooIfaces.PP,
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
    decodeReaderResult(readerResult, wooFi.wooIfaces.PP, funcName),
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
});
