import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { Morphex } from './morphex';
import { MorphexConfig } from './config';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import ReaderABI from '../../abi/gmx/reader.json';

const network = Network.FANTOM;
const TokenASymbol = 'axlUSDC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'WFTM';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  0n,
  1000000000n,
  2000000000n,
  3000000000n,
  4000000000n,
  5000000000n,
];

const dexKey = 'Morphex';
const params = MorphexConfig[dexKey][network];
const readerInterface = new Interface(ReaderABI);
const readerAddress = params.reader;

describe('Morphex', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const gmx = new Morphex(network, dexKey, dexHelper);

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

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const gmx = new Morphex(network, dexKey, dexHelper);

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
