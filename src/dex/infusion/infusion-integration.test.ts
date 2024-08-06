/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { checkPoolPrices } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';
import { Infusion } from './infusion';
import { Tokens } from '../../../tests/constants-e2e';
import { Interface, Result } from '@ethersproject/abi';
import infusionPairABI from '../../abi/infusion/InfusionPair.json';
import { Velodrome } from './forks-override/velodrome';

const amounts18 = [0n, BI_POWS[18], 2000000000000000000n];
const amounts6 = [0n, BI_POWS[6], 2000000n];

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

const constructCheckOnChainPricing =
  (dexHelper: DummyDexHelper) =>
  async (
    infusion: Infusion,
    funcName: string,
    blockNumber: number,
    prices: bigint[],
    exchangeAddress: string,
    tokenIn: string,
    amounts: bigint[],
  ) => {
    const readerIface = new Interface(infusionPairABI as any);

    const readerCallData = getReaderCalldata(
      exchangeAddress,
      readerIface,
      amounts.slice(1),
      funcName,
      tokenIn,
    );

    const readerResult = (
      await dexHelper.multiContract.methods
        .aggregate(readerCallData)
        .call({}, blockNumber)
    ).returnData;
    const expectedPrices = [0n].concat(
      decodeReaderResult(readerResult, readerIface, funcName),
    );

    console.log('ON-CHAIN PRICES: ', expectedPrices);

    expect(prices.map(p => p.toString())).toEqual(
      expectedPrices.map(p => p.toString()),
    );
  };

describe('Infusion integration tests', () => {
  describe('Base', () => {
    const network = Network.BASE;
    const dexHelper = new DummyDexHelper(network);
    const checkOnChainPricing = constructCheckOnChainPricing(dexHelper);

    describe('Velodrome', () => {
      const dexKey = 'Infusion';
      const velodrome = new Velodrome(network, dexKey, dexHelper);

      describe('UniswapV2 like pool', function () {
        const TokenASymbol = 'USDC';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'WETH';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18;

        it('getPoolIdentifiers and getPricesVolume SELL', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await velodrome.getPoolIdentifiers(
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

          const poolPrices = await velodrome.getPricesVolume(
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

          for (const poolPrice of poolPrices || []) {
            await checkOnChainPricing(
              velodrome,
              'getAmountOut',
              blocknumber,
              poolPrice.prices,
              poolPrice.poolAddresses![0],
              tokenA.address,
              amounts,
            );
          }
        });
      });

      describe('Curve like stable pool', function () {
        const TokenASymbol = 'USDbC';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'USDC';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts6;

        it('getPoolIdentifiers and getPricesVolume SELL', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await velodrome.getPoolIdentifiers(
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

          const poolPrices = await velodrome.getPricesVolume(
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
          for (const poolPrice of poolPrices || []) {
            await checkOnChainPricing(
              velodrome,
              'getAmountOut',
              blocknumber,
              poolPrice.prices,
              poolPrice.poolAddresses![0],
              tokenA.address,
              amounts,
            );
          }
        });
      });
    });
  });
});
