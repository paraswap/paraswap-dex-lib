import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../../dex-helper';
import { Network, SwapSide } from '../../../constants';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../../tests/utils';
import { BI_POWS } from '../../../bigint-constants';
import { Dystopia } from './dystopia';
import { Tokens } from '../../../../tests/constants-e2e';
import { Interface, Result } from '@ethersproject/abi';

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'Dystopia';
const network = Network.POLYGON;
const dexHelper = new DummyDexHelper(network);
const dystopia = new Dystopia(network, dexKey, dexHelper);

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  // TODO: Put here additional arguments you need
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      // TODO: Put here additional arguments to encode them
      amount,
    ]),
  }));
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
) {
  // TODO: Adapt this function for your needs
  return results.map(result => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    return BigInt(parsed[0]._hex);
  });
}

async function checkOnChainPricing(
  dystopia: Dystopia,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
) {
  const exchangeAddress = ''; // TODO: Put here the real exchange address

  // TODO: Replace dummy interface with the real one
  // Normally you can get it from __DexNameCamel__.Iface or from eventPool.
  // It depends on your implementation
  const readerIface = dystopia.Iface;

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
  );
  const readerResult = (
    await dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;
  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

describe('Dystopia', function () {
  describe('UniswapV2 like pool', function () {
    const TokenASymbol = 'WETH';
    const tokenA = Tokens[network][TokenASymbol];
    const TokenBSymbol = 'WMATIC';
    const tokenB = Tokens[network][TokenBSymbol];

    it('getPoolIdentifiers and getPricesVolume', async function () {
      const blocknumber = await dexHelper.provider.getBlockNumber();
      const dystopia = new Dystopia(network, dexKey, dexHelper);
      const pools = await dystopia.getPoolIdentifiers(
        tokenA,
        tokenB,
        SwapSide.SELL,
        blocknumber,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await dystopia.getPricesVolume(
        tokenA,
        tokenB,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

      // Check if onchain pricing equals to calculated ones
      await checkOnChainPricing(
        dystopia,
        '', // TODO: Put here the functionName to call
        blocknumber,
        poolPrices![0].prices,
      );
    });

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(Network.POLYGON);
      const dystopia = new Dystopia(Network.POLYGON, dexKey, dexHelper);

      const poolLiquidity = await dystopia.getTopPoolsForToken(
        tokenA.address,
        10,
      );
      console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
    });
  });

  describe('Curve like stable pool', function () {
    const TokenASymbol = 'USDC';
    const tokenA = Tokens[Network.POLYGON][TokenASymbol];
    const TokenBSymbol = 'USDT';
    const tokenB = Tokens[Network.POLYGON][TokenBSymbol];

    it('getPoolIdentifiers and getPricesVolume', async function () {
      const dexHelper = new DummyDexHelper(Network.POLYGON);
      const blocknumber = await dexHelper.provider.getBlockNumber();
      const pools = await dystopia.getPoolIdentifiers(
        tokenA,
        tokenB,
        SwapSide.SELL,
        blocknumber,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await dystopia.getPricesVolume(
        tokenA,
        tokenB,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

      // Check if onchain pricing equals to calculated ones
      await checkOnChainPricing(
        dystopia,
        '', // TODO: Put here the functionName to call
        blocknumber,
        poolPrices![0].prices,
      );
    });

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(Network.POLYGON);
      const dystopiaStable = new Dystopia(Network.POLYGON, dexKey, dexHelper);

      const poolLiquidity = await dystopiaStable.getTopPoolsForToken(
        tokenA.address,
        10,
      );
      console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
    });
  });
});
