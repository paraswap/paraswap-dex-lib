import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BMX } from './bmx';
import { BMXConfig } from './config';
import ReaderABI from '../../abi/gmx/reader.json';
import { Tokens } from '../../../tests/constants-e2e';
import {
  checkConstantPoolPrices,
  checkPoolPrices,
  checkPoolsLiquidity,
} from '../../../tests/utils';

const dexKey = 'Bmx';

describe('BMX Base', function () {
  const network = Network.BASE;
  const TokenASymbol = 'USDC';
  const TokenA = Tokens[network][TokenASymbol];

  const TokenBSymbol = 'WETH';
  const TokenB = Tokens[network][TokenBSymbol];

  const amounts = [
    0n,
    1000000000n,
    2000000000n,
    3000000000n,
    4000000000n,
    5000000000n,
  ];

  const readerInterface = new Interface(ReaderABI);
  const params = BMXConfig[dexKey][network];
  const readerAddress = params.reader;

  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const gmx = new BMX(network, dexKey, dexHelper);

    await gmx.initializePricing(blocknumber);

    const pools = await gmx.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await gmx.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (gmx.hasConstantPriceLargeAmounts) {
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

  it('getTopPoolsForToken USDC', async function () {
    const dexHelper = new DummyDexHelper(network);
    const gmx = new BMX(network, dexKey, dexHelper);

    await gmx.updatePoolState();
    const poolLiquidity = await gmx.getTopPoolsForToken(TokenA.address, 10);
    console.log(
      `${TokenASymbol} Top Pools:`,
      JSON.stringify(poolLiquidity, null, 2),
    );

    if (!gmx.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});

describe('WBLT Base', function () {
  const network = Network.BASE;
  const TokenASymbol = 'WBLT';
  const TokenA = Tokens[network][TokenASymbol];

  const TokenBSymbol = 'USDC';
  const TokenB = Tokens[network][TokenBSymbol];

  const amountsA = [
    0n,
    10n ** 18n,
    2n * 10n ** 18n,
    3n * 10n ** 18n,
    4n * 10n ** 18n,
    5n * 10n ** 18n,
  ];

  const amountsB = [
    0n,
    10n ** 6n,
    2n * 10n ** 6n,
    3n * 10n ** 6n,
    4n * 10n ** 6n,
    5n * 10n ** 6n,
  ];

  it('getPoolIdentifiers and getPricesVolume SELL (WBLT -> USDC)', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const gmx = new BMX(network, dexKey, dexHelper);

    await gmx.initializePricing(blocknumber);

    const pools = await gmx.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await gmx.getPricesVolume(
      TokenA,
      TokenB,
      amountsA,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (gmx.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amountsA, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amountsA, SwapSide.SELL, dexKey);
    }
  });

  it('getPoolIdentifiers and getPricesVolume SELL (USDC -> WBLT)', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const gmx = new BMX(network, dexKey, dexHelper);

    await gmx.initializePricing(blocknumber);

    const pools = await gmx.getPoolIdentifiers(
      TokenB,
      TokenA,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenBSymbol} <> ${TokenASymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await gmx.getPricesVolume(
      TokenB,
      TokenA,
      amountsB,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (gmx.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amountsB, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amountsB, SwapSide.SELL, dexKey);
    }
  });

  it('getTopPoolsForToken WBLT', async function () {
    const dexHelper = new DummyDexHelper(network);
    const gmx = new BMX(network, dexKey, dexHelper);

    await gmx.updatePoolState();
    const poolLiquidity = await gmx.getTopPoolsForToken(TokenA.address, 10);
    console.log(
      `${TokenASymbol} Top Pools:`,
      JSON.stringify(poolLiquidity, null, 2),
    );

    if (!gmx.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});
