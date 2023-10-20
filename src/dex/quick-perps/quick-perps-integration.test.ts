/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { QuickPerps } from './quick-perps';
import { QuickPerpsConfig } from './config';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import ReaderABI from '../../abi/quick-perps/reader.json';

const network = Network.ZKEVM;
const dexKey = 'QuickPerps';
const params = QuickPerpsConfig[dexKey][network];
const readerInterface = new Interface(ReaderABI);
const readerAddress = '0xf1CFB75854DE535475B88Bb6FBad317eea98c0F9';

function testsForCase(
  tokenASymbol: string,
  tokenBSymbol: string,
  amounts: bigint[],
) {
  const TokenA = Tokens[network][tokenASymbol];
  const TokenB = Tokens[network][tokenBSymbol];

  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const quickPerps = new QuickPerps(network, dexKey, dexHelper);

    await quickPerps.initializePricing(blocknumber);

    const pools = await quickPerps.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${tokenASymbol} <> ${tokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await quickPerps.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${tokenASymbol} <> ${tokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (quickPerps.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    // Do on chain pricing based on reader to compare
    const readerCallData = amounts.map(a => ({
      target: readerAddress,
      callData: readerInterface.encodeFunctionData('getAmountOut', [
        params.vault,
        TokenA.address,
        TokenB.address,
        a.toString(),
      ]),
    }));

    const readerResult = (
      await dexHelper.multiContract.methods
        .aggregate(readerCallData)
        .call({}, blocknumber)
    ).returnData;
    const expectedPrices = readerResult.map((p: any) =>
      BigInt(
        readerInterface.decodeFunctionResult('getAmountOut', p)[0].toString(),
      ),
    );

    expect(poolPrices![0].prices).toEqual(expectedPrices);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const quickPerps = new QuickPerps(network, dexKey, dexHelper);

    await quickPerps.updatePoolState();
    const poolLiquidity = await quickPerps.getTopPoolsForToken(
      TokenA.address,
      10,
    );
    console.log(
      `${tokenASymbol} Top Pools:`,
      JSON.stringify(poolLiquidity, null, 2),
    );

    if (!quickPerps.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
}

describe('QuickPerps', function () {
  describe('WETH -> MATIC', function () {
    const TokenASymbol = 'WETH';
    const TokenBSymbol = 'MATIC';

    const amounts = [
      0n,
      100000000000000000n,
      200000000000000000n,
      300000000000000000n,
      400000000000000000n,
      500000000000000000n,
      600000000000000000n,
      700000000000000000n,
      800000000000000000n,
      900000000000000000n,
      1000000000000000000n,
    ];

    testsForCase(TokenASymbol, TokenBSymbol, amounts);
  });

  describe('WBTC -> USDC', function () {
    const TokenASymbol = 'WBTC';
    const TokenBSymbol = 'USDC';

    const amounts = [
      0n,
      100000000n,
      200000000n,
      300000000n,
      400000000n,
      500000000n,
      600000000n,
      700000000n,
      800000000n,
      900000000n,
      1000000000n,
    ];

    testsForCase(TokenASymbol, TokenBSymbol, amounts);
  });
});
