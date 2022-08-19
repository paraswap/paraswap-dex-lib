import dotenv from 'dotenv';
dotenv.config();

// @ts-ignore
import { checkPoolPrices, checkPoolsLiquidity } from '../../../../tests/utils';
// @ts-ignore
import { Tokens } from '../../../../tests/constants-e2e';
import { DummyDexHelper } from '../../../dex-helper';
import { Network, SwapSide } from '../../../constants';
import { BI_POWS } from '../../../bigint-constants';
import { Cone } from './cone';
import { Interface, Result } from '@ethersproject/abi';
import conePairABI from '../../../abi/uniswap-v2/ConePair.json';

const amounts18 = [0n, BI_POWS[18], 2000000000000000000n];
// const amounts6 = [0n, BI_POWS[6], BI_POWS[6] * 2n];

const dexKey = 'Cone';
const network = Network.BSC;
const dexHelper = new DummyDexHelper(network);
const cone = new Cone(network, dexKey, dexHelper);

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  tokenIn: string,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [amount, tokenIn]),
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
  cone: Cone,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  exchangeAddress: string,
  tokenIn: string,
  amounts: bigint[],
) {
  const readerIface = new Interface(conePairABI as any);

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    tokenIn,
  );
  console.log('readerCallData', readerCallData);
  const readerResult = (
    await dexHelper.multiContract.methods
      .aggregate(readerCallData)
      .call({}, blockNumber)
  ).returnData;
  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  console.log('prices', prices);
  console.log('expectedPrices', expectedPrices);

  expect(prices).toEqual(expectedPrices);
}

describe('Cone', function () {
  describe('UniswapV2 like pool', function () {
    const TokenASymbol = 'WBNB';
    const tokenA = Tokens[network][TokenASymbol];
    const TokenBSymbol = 'CONE';
    const tokenB = Tokens[network][TokenBSymbol];

    const amounts = amounts18;

    it('getPoolIdentifiers and getPricesVolume', async function () {
      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const cone = new Cone(network, dexKey, dexHelper);
      const pools = await cone.getPoolIdentifiers(
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

      const poolPrices = await cone.getPricesVolume(
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

      // Check if onchain pricing equals to calculated ones

      for (const i in poolPrices || []) {
        await checkOnChainPricing(
          cone,
          'getAmountOut',
          blocknumber,
          poolPrices![i].prices,
          poolPrices![i].poolAddresses![0],
          tokenA.address,
          amounts,
        );
      }

      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    });

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(network);
      const cone = new Cone(network, dexKey, dexHelper);

      const poolLiquidity = await cone.getTopPoolsForToken(tokenA.address, 10);
      console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
    });
  });

  describe('Curve like stable pool', function () {
    const TokenASymbol = 'USDT'; // 'USDT';
    const tokenA = Tokens[network][TokenASymbol];
    const TokenBSymbol = 'BUSD';
    const tokenB = Tokens[network][TokenBSymbol];

    const amounts = amounts18; // amounts6;

    it('getPoolIdentifiers and getPricesVolume', async function () {
      const dexHelper = new DummyDexHelper(network);
      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const pools = await cone.getPoolIdentifiers(
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

      const poolPrices = await cone.getPricesVolume(
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
      for (const i in poolPrices || []) {
        await checkOnChainPricing(
          cone,
          'getAmountOut',
          blocknumber,
          poolPrices![i].prices,
          poolPrices![i].poolAddresses![0],
          tokenA.address,
          amounts,
        );
      }
    });

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(network);
      const coneStable = new Cone(network, dexKey, dexHelper);

      const poolLiquidity = await coneStable.getTopPoolsForToken(
        tokenA.address,
        10,
      );
      console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
    });
  });
});
