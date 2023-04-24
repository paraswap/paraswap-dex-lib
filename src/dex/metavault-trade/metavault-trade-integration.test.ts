import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { MetavaultTrade } from './metavault-trade';
import { MetavaultTradeConfig } from './config';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import ReaderABI from '../../abi/metavault-trade/reader.json';

const network = Network.POLYGON;
const TokenASymbol = 'USDT';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'WMATIC';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  0n,
  1000000000n,
  2000000000n,
  3000000000n,
  4000000000n,
  5000000000n,
];

const dexKey = 'MetavaultTrade';
const params = MetavaultTradeConfig[dexKey][network];
const readerInterface = new Interface(ReaderABI);
const readerAddress = '0x01dd8b434a83cbddfa24f2ef1fe2d6920ca03734';

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
