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

describe('WooFi', function () {
  it('getPoolIdentifiers and getPricesVolume SELL Base', async function () {
    const blockNumber = await dexHelper.provider.getBlockNumber();

    const wooFi = new WooFi(network, dexKey, dexHelper);
    await wooFi.initializePricing(blockNumber);

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
    const funcName = 'querySellBase';
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

    // const test = wooFi.math.querySellBase(
    //   wooFi.latestState!,
    //   TokenB.address,
    //   TokenA.address,
    //   amounts[1],
    // );

    // const wooPP = new WooPP(wooFi.config.quoteToken);
    // const baseInfo =
    //   wooFi.latestState!.tokenInfos[TokenA.address.toLowerCase()];
    // const quoteInfo =
    //   wooFi.latestState!.tokenInfos[TokenB.address.toLowerCase()];
    // const baseState =
    //   wooFi.latestState!.tokenStates[TokenA.address.toLowerCase()];
    // const fee = wooFi.latestState!.feeRates[TokenA.address.toLowerCase()];
    // const realRes = wooPP.QuerySellBase(
    //   { address: TokenA.address, decimals: 18 },
    //   new WooppTokenInfo(
    //     new BigNumber(baseInfo.reserve.toString()),
    //     new BigNumber(fee.toString()),
    //     new BigNumber(baseInfo.R.toString()),
    //   ),
    //   new WooppTokenInfo(
    //     new BigNumber(quoteInfo.reserve.toString()),
    //     new BigNumber('0'),
    //     new BigNumber(quoteInfo.R.toString()),
    //   ),
    //   new WooracleState(
    //     new BigNumber(baseState.priceNow.toString()),
    //     new BigNumber(baseState.spreadNow.toString()),
    //     new BigNumber(baseState.coeffNow.toString()),
    //   ),
    //   new BigNumber(amounts[1].toString()),
    // );

    expect(poolPrices![0].prices).toEqual(expectedPrices);
  });

  it('getPoolIdentifiers and getPricesVolume SELL Quote', async function () {
    const blockNumber = await dexHelper.provider.getBlockNumber();
    const wooFi = new WooFi(network, dexKey, dexHelper);
    await wooFi.initializePricing(blockNumber);

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

    // Check if onchain pricing equals to calculated ones
    const funcName = 'querySellQuote';
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

    expect(poolPrices![0].prices).toEqual(expectedPrices);
  });

  // it('getPoolIdentifiers and getPricesVolume BUY', async function () {
  //   const blockNumber = await dexHelper.provider.getBlockNumber();

  //   const wooFi = new WooFi(network, dexKey, dexHelper);
  //   await wooFi.initializePricing(blockNumber);

  //   const pools = await wooFi.getPoolIdentifiers(
  //     TokenA,
  //     TokenB,
  //     SwapSide.BUY,
  //     blockNumber,
  //   );
  //   console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

  //   expect(pools.length).toBeGreaterThan(0);

  //   const poolPrices = await wooFi.getPricesVolume(
  //     TokenA,
  //     TokenB,
  //     amounts,
  //     SwapSide.BUY,
  //     blockNumber,
  //     pools,
  //   );
  //   console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

  //   expect(poolPrices).not.toBeNull();
  //   if (wooFi.hasConstantPriceLargeAmounts) {
  //     checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  //   } else {
  //     checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey);
  //   }
  // });

  it('getTopPoolsForToken Base', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blockNumber = await dexHelper.provider.getBlockNumber();

    const wooFi = new WooFi(network, dexKey, dexHelper);
    await wooFi.initializePricing(blockNumber);

    const poolLiquidity = await wooFi.getTopPoolsForToken(TokenA.address, 10);
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!wooFi.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });

  it('getTopPoolsForToken Quote', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blockNumber = await dexHelper.provider.getBlockNumber();

    const wooFi = new WooFi(network, dexKey, dexHelper);
    await wooFi.initializePricing(blockNumber);

    const poolLiquidity = await wooFi.getTopPoolsForToken(TokenB.address, 10);
    console.log(`${TokenBSymbol} Top Pools:`, poolLiquidity);

    if (!wooFi.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenB.address, dexKey);
    }
  });
});
