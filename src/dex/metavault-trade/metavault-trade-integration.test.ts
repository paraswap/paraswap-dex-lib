import { MetavaultTradeConfig } from './config';
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { MetavaultTrade } from './metavault-trade';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import ReaderABI from '../../abi/metavault-trade/reader.json';

const network = Network.POLYGON;
const TokenASymbol = 'DAI';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'WBTC';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  0n,
  1n * BI_POWS[TokenA.decimals],
  2n * BI_POWS[TokenA.decimals],
  3n * BI_POWS[TokenA.decimals],
  4n * BI_POWS[TokenA.decimals],
  5n * BI_POWS[TokenA.decimals],
  6n * BI_POWS[TokenA.decimals],
  7n * BI_POWS[TokenA.decimals],
  8n * BI_POWS[TokenA.decimals],
  9n * BI_POWS[TokenA.decimals],
  10n * BI_POWS[TokenA.decimals],
];

const dexKey = 'MetavaultTrade';
const params = MetavaultTradeConfig[dexKey][network];
const readerInterface = new Interface(ReaderABI);
const readerAddress = '0x01dd8B434A83cbdDFa24f2ef1fe2D6920ca03734';

describe('MetavaultTrade', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const metavaultTrade = new MetavaultTrade(network, dexKey, dexHelper);

    await metavaultTrade.initializePricing(blocknumber);

    const pools = await metavaultTrade.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );

    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await metavaultTrade.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (metavaultTrade.hasConstantPriceLargeAmounts) {
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

    console.log('readerCallData', readerCallData);

    const readerResult = (
      await dexHelper.multiContract.methods
        .aggregate(readerCallData)
        .call({}, blocknumber)
    ).returnData;

    console.log('readerResult');
    console.log(readerResult);

    const expectedPrices = readerResult.map((p: any) =>
      BigInt(
        readerInterface.decodeFunctionResult('getAmountOut', p)[0].toString(),
      ),
    );

    expect(poolPrices![0].prices).toEqual(expectedPrices);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const metavaultTrade = new MetavaultTrade(network, dexKey, dexHelper);

    await metavaultTrade.updatePoolState();
    const poolLiquidity = await metavaultTrade.getTopPoolsForToken(
      TokenA.address,
      10,
    );
    console.log(
      `${TokenASymbol} Top Pools:`,
      JSON.stringify(poolLiquidity, null, 2),
    );

    if (!metavaultTrade.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});
