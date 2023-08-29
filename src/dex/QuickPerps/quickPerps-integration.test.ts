import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { QuickPerps } from './quickPerps';
import { QuickPerpsConfig } from './config';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import ReaderABI from '../../abi/quickPerps/reader.json';

const network = Network.AVALANCHE;
const TokenASymbol = 'USDCe';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'WAVAX';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  0n,
  1000000000n,
  2000000000n,
  3000000000n,
  4000000000n,
  5000000000n,
];

const dexKey = 'QuickPerps';
const params = QuickPerpsConfig[dexKey][network];
const readerInterface = new Interface(ReaderABI);
const readerAddress = '0x67b789D48c926006F5132BFCe4e976F0A7A63d5D';

describe('QuickPerps', function () {
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
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await quickPerps.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

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
      `${TokenASymbol} Top Pools:`,
      JSON.stringify(poolLiquidity, null, 2),
    );

    if (!quickPerps.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});
