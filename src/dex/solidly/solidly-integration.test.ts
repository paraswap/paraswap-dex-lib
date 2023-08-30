import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';
import { Solidly } from './solidly';
import { Tokens } from '../../../tests/constants-e2e';
import { Interface, Result } from '@ethersproject/abi';
import solidlyPairABI from '../../abi/solidly/SolidlyPair.json';
import { SpiritSwapV2 } from './forks-override/spiritSwapV2';
import { Cone } from './forks-override/cone';
import { Chronos } from './forks-override/chronos';
import { Ramses } from './forks-override/ramses';
import * as util from 'util';
import { VelodromeV2 } from './forks-override/velodromeV2';

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
    soldily: Solidly,
    funcName: string,
    blockNumber: number,
    prices: bigint[],
    exchangeAddress: string,
    tokenIn: string,
    amounts: bigint[],
  ) => {
    const readerIface = new Interface(solidlyPairABI as any);

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

describe('Solidly integration tests', () => {
  describe('Fantom', () => {
    const network = Network.FANTOM;
    const dexHelper = new DummyDexHelper(network);
    const checkOnChainPricing = constructCheckOnChainPricing(dexHelper);

    describe('Solidly', function () {
      const dexKey = 'Solidly';
      const soldily = new Solidly(network, dexKey, dexHelper);

      describe('UniswapV2 like pool', function () {
        const TokenASymbol = 'WFTM';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'FUSDT';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18;

        it('getPoolIdentifiers and getPricesVolume', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await soldily.getPoolIdentifiers(
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

          const poolPrices = await soldily.getPricesVolume(
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
              soldily,
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
          const poolLiquidity = await soldily.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });

      describe('Curve like stable pool', function () {
        const TokenASymbol = 'FUSDT';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'USDC';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18; // amounts6;

        it('getPoolIdentifiers and getPricesVolume', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await soldily.getPoolIdentifiers(
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

          const poolPrices = await soldily.getPricesVolume(
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
              soldily,
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
          const poolLiquidity = await soldily.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });
    });

    describe('SpiritSwapV2', function () {
      const dexKey = 'SpiritSwapV2';
      const spiritSwapV2 = new SpiritSwapV2(network, dexKey, dexHelper);

      describe('UniswapV2 like pool', function () {
        const TokenASymbol = 'WFTM';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'FUSDT';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18;

        it('getPoolIdentifiers and getPricesVolume', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await spiritSwapV2.getPoolIdentifiers(
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

          const poolPrices = await spiritSwapV2.getPricesVolume(
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
              spiritSwapV2,
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
          const poolLiquidity = await spiritSwapV2.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });

      describe('Curve like stable pool', function () {
        const TokenASymbol = 'FUSDT';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'USDC';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18; // amounts6;

        it('getPoolIdentifiers and getPricesVolume', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await spiritSwapV2.getPoolIdentifiers(
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

          const poolPrices = await spiritSwapV2.getPricesVolume(
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
              spiritSwapV2,
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
          const poolLiquidity = await spiritSwapV2.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });
    });
  });

  describe('Polygon', () => {
    const network = Network.POLYGON;
    const dexHelper = new DummyDexHelper(network);
    const checkOnChainPricing = constructCheckOnChainPricing(dexHelper);

    describe('Dystopia', function () {
      const dexKey = 'Dystopia';
      const dystopia = new Solidly(network, dexKey, dexHelper);

      describe('UniswapV2 like pool', function () {
        const TokenASymbol = 'WETH';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'WMATIC';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18;

        it('getPoolIdentifiers and getPricesVolume', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
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

          for (const i in poolPrices || []) {
            await checkOnChainPricing(
              dystopia,
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
          const poolLiquidity = await dystopia.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });

      describe('Curve like stable pool', function () {
        const TokenASymbol = 'DAI'; // 'USDT';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'USDC';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18; // amounts6;

        it('getPoolIdentifiers and getPricesVolume', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
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
          for (const i in poolPrices || []) {
            await checkOnChainPricing(
              dystopia,
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
          const poolLiquidity = await dystopia.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });
    });
  });

  describe('BSC', () => {
    const network = Network.BSC;
    const dexHelper = new DummyDexHelper(network);
    const checkOnChainPricing = constructCheckOnChainPricing(dexHelper);

    describe('Cone', function () {
      const dexKey = 'Cone';
      const cone = new Cone(network, dexKey, dexHelper);

      describe('UniswapV2 like pool', function () {
        const TokenASymbol = 'WBNB';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'BUSD';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18;

        it('getPoolIdentifiers and getPricesVolume', async function () {
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
          const poolLiquidity = await cone.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });

      describe('Curve like stable pool', function () {
        const TokenASymbol = 'USDT';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'BUSD';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts6;

        it('getPoolIdentifiers and getPricesVolume', async function () {
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
          const poolLiquidity = await cone.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });
    });
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const dexHelper = new DummyDexHelper(network);
    const checkOnChainPricing = constructCheckOnChainPricing(dexHelper);

    describe('Chronos', function () {
      const dexKey = 'Chronos';
      const chronos = new Chronos(network, dexKey, dexHelper);

      describe('UniswapV2 like pool', function () {
        const TokenASymbol = 'USDC';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'WETH';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18;

        it('getPoolIdentifiers and getPricesVolume', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await chronos.getPoolIdentifiers(
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

          const poolPrices = await chronos.getPricesVolume(
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
              chronos,
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
          const poolLiquidity = await chronos.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });

      describe('Curve like stable pool', function () {
        const TokenASymbol = 'USDT';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'USDC';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts6;

        it('getPoolIdentifiers and getPricesVolume', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await chronos.getPoolIdentifiers(
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

          const poolPrices = await chronos.getPricesVolume(
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
              chronos,
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
          const poolLiquidity = await chronos.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });
    });

    describe('Ramses', function () {
      const dexKey = 'Ramses';
      const ramses = new Ramses(network, dexKey, dexHelper);

      describe('UniswapV2 like pool', function () {
        const TokenASymbol = 'USDCe';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'WETH';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18;

        it('getPoolIdentifiers and getPricesVolume', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await ramses.getPoolIdentifiers(
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

          console.log('AMOUNTS: ', amounts);

          const poolPrices = await ramses.getPricesVolume(
            tokenA,
            tokenB,
            amounts,
            SwapSide.SELL,
            blocknumber,
            pools,
          );
          console.log(
            `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
            util.inspect(poolPrices, false, null, true),
          );

          expect(poolPrices).not.toBeNull();
          // checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

          // Check if onchain pricing equals to calculated ones

          for (const i in poolPrices || []) {
            await checkOnChainPricing(
              ramses,
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
          const poolLiquidity = await ramses.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });

      describe('Curve like stable pool', function () {
        const TokenASymbol = 'USDT';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'USDCe';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts6;

        it('getPoolIdentifiers and getPricesVolume', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await ramses.getPoolIdentifiers(
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

          const poolPrices = await ramses.getPricesVolume(
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
              ramses,
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
          const poolLiquidity = await ramses.getTopPoolsForToken(
            tokenA.address,
            10,
          );
          console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

          checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
        });
      });
    });
  });

  describe('Optimism', () => {
    const network = Network.OPTIMISM;
    const dexHelper = new DummyDexHelper(network);
    const checkOnChainPricing = constructCheckOnChainPricing(dexHelper);

    describe('VelodromeV2', () => {
      const dexKey = 'VelodromeV2';
      const velodromeV2 = new VelodromeV2(network, dexKey, dexHelper);

      describe('UniswapV2 like pool', function () {
        const TokenASymbol = 'USDC';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'WETH';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts18;

        it('getPoolIdentifiers and getPricesVolume SELL', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await velodromeV2.getPoolIdentifiers(
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

          const poolPrices = await velodromeV2.getPricesVolume(
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
              velodromeV2,
              'getAmountOut',
              blocknumber,
              poolPrices![i].prices,
              poolPrices![i].poolAddresses![0],
              tokenA.address,
              amounts,
            );
          }
        });
      });

      describe('Curve like stable pool', function () {
        const TokenASymbol = 'USDT';
        const tokenA = Tokens[network][TokenASymbol];
        const TokenBSymbol = 'USDC';
        const tokenB = Tokens[network][TokenBSymbol];

        const amounts = amounts6;

        it('getPoolIdentifiers and getPricesVolume SELL', async function () {
          const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
          const pools = await velodromeV2.getPoolIdentifiers(
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

          const poolPrices = await velodromeV2.getPricesVolume(
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
              velodromeV2,
              'getAmountOut',
              blocknumber,
              poolPrices![i].prices,
              poolPrices![i].poolAddresses![0],
              tokenA.address,
              amounts,
            );
          }
        });
      });
    });
  });
});
