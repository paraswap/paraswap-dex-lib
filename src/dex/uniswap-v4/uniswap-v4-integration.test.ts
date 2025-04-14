/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();
import { DummyDexHelper, IDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { UniswapV4 } from './uniswap-v4';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';
import { Interface, Result } from '@ethersproject/abi';
import QuoterAbi from '../../abi/uniswap-v4/quoter.abi.json';
import { PoolKey } from './types';
import * as util from 'util';
import { checkPoolsLiquidity } from '../../../tests/utils';

const quoterIface = new Interface(QuoterAbi);

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  poolKey: PoolKey,
  zeroForOne: boolean,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      {
        poolKey,
        zeroForOne,
        exactAmount: amount.toString(),
        hookData: '0x',
      },
    ]),
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
  dexHelper: IDexHelper,
  funcName: string,
  blockNumber: number,
  exchangeAddress: string,
  prices: bigint[],
  poolKey: PoolKey,
  zeroForOne: boolean,
  _amounts: bigint[],
  readerIface = quoterIface,
) {
  const sum = prices.reduce((acc, curr) => (acc += curr), 0n);

  if (sum === 0n) {
    console.log(
      `Prices were not calculated for pool ${poolKey.toString()} (zeroForOne: ${zeroForOne}). Most likely price impact is too big for requested amount`,
    );
    return false;
  }

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    _amounts.slice(1),
    funcName,
    poolKey,
    zeroForOne,
  );

  // console.log('readerCallData: ', readerCallData);

  let readerResult;
  try {
    readerResult = (
      await dexHelper.multiContract.methods
        .aggregate(readerCallData)
        .call({}, blockNumber)
    ).returnData;
  } catch (e) {
    console.log('E: ', e);
    console.log('PRICES: ', prices);
    console.log('pool key: ', poolKey);
    console.log('readerCallData: ', readerCallData);
    console.log(
      `Can not fetch on-chain pricing for pool ${JSON.stringify(
        poolKey,
      )}. It happens for low liquidity pools`,
      e,
    );
    return false;
  }

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  let firstZeroIndex = prices.slice(1).indexOf(0n);

  // we skipped first, so add +1 on result
  firstZeroIndex = firstZeroIndex === -1 ? prices.length : firstZeroIndex;

  console.log('amounts: ', _amounts);
  console.log('prices: ', prices);
  console.log('expectedPrices: ', expectedPrices);

  // Compare only the ones for which we were able to calculate prices
  expect(prices.slice(0, firstZeroIndex)).toEqual(
    expectedPrices.slice(0, firstZeroIndex),
  );

  expect(prices).toStrictEqual(expectedPrices);

  return true;
}

describe('UniswapV4 integration tests', () => {
  const dexKey = 'UniswapV4';

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);

    let blockNumber: number;
    let uniswapV4: UniswapV4;

    describe('WETH -> USDC', () => {
      const TokenASymbol = 'WETH';
      const TokenA = Tokens[network][TokenASymbol];

      const TokenBSymbol = 'USDC';
      const TokenB = Tokens[network][TokenBSymbol];

      beforeEach(async () => {
        blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
        uniswapV4 = new UniswapV4(network, dexKey, dexHelper);
        await uniswapV4.initializePricing(blockNumber);
      });

      it('WETH -> USDC getPoolIdentifiers and getPricesVolume SELL', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          2n * BI_POWS[18],
          3n * BI_POWS[18],
          4n * BI_POWS[18],
          5n * BI_POWS[18],
          6n * BI_POWS[18],
          7n * BI_POWS[18],
          8n * BI_POWS[18],
          9n * BI_POWS[18],
          10n * BI_POWS[18],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('WETH -> USDC getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK: ', blockNumber);
        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> WETH getPoolIdentifiers and getPricesVolume SELL', async () => {
        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> WETH getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK :', blockNumber);
        const amounts = [
          0n,
          1n * BI_POWS[15],
          2n * BI_POWS[15],
          3n * BI_POWS[15],
          4n * BI_POWS[15],
          5n * BI_POWS[15],
          6n * BI_POWS[15],
          7n * BI_POWS[15],
          8n * BI_POWS[15],
          9n * BI_POWS[15],
          1n * BI_POWS[16],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('WETH getTopPoolsForToken', async function () {
        const poolLiquidity = await uniswapV4.getTopPoolsForToken(
          TokenA.address,
          10,
        );
        console.log(
          `${TokenASymbol} Top Pools:`,
          util.inspect(poolLiquidity, false, null, true),
        );

        if (!uniswapV4.hasConstantPriceLargeAmounts) {
          checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
        }
      });

      it('USDC getTopPoolsForToken', async function () {
        const poolLiquidity = await uniswapV4.getTopPoolsForToken(
          TokenB.address,
          10,
        );
        console.log(
          `${TokenASymbol} Top Pools:`,
          util.inspect(poolLiquidity, false, null, true),
        );

        if (!uniswapV4.hasConstantPriceLargeAmounts) {
          checkPoolsLiquidity(poolLiquidity, TokenB.address, dexKey);
        }
      });
    });

    describe('USDC -> USDT', () => {
      const TokenASymbol = 'USDC';
      const TokenA = Tokens[network][TokenASymbol];

      const TokenBSymbol = 'USDT';
      const TokenB = Tokens[network][TokenBSymbol];

      beforeEach(async () => {
        blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
        // blockNumber = 22187895;
        uniswapV4 = new UniswapV4(network, dexKey, dexHelper);
        await uniswapV4.initializePricing(blockNumber);
      });

      it('USDC -> USDT getPoolIdentifiers and getPricesVolume SELL', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          11n * BI_POWS[6],
          12n * BI_POWS[6],
          13n * BI_POWS[6],
          14n * BI_POWS[6],
          15n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        // const poolPrices = prices!.filter(
        //   pool =>
        //     pool!.poolIdentifier?.toLowerCase() ===
        //     '0x3ad280c97568a027da5e10bf3e757886fc4e2fa301959d7bb6c296d3e39f30b5'.toLowerCase(),
        // );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> USDT getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          11n * BI_POWS[6],
          12n * BI_POWS[6],
          13n * BI_POWS[6],
          14n * BI_POWS[6],
          15n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDT -> USDC getPoolIdentifiers and getPricesVolume SELL', async () => {
        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          11n * BI_POWS[6],
          12n * BI_POWS[6],
          13n * BI_POWS[6],
          14n * BI_POWS[6],
          15n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDT -> USDC getPoolIdentifiers and getPricesVolume BUY', async () => {
        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          11n * BI_POWS[6],
          12n * BI_POWS[6],
          13n * BI_POWS[6],
          14n * BI_POWS[6],
          15n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });
    });

    describe('ETH -> USDC', () => {
      const TokenASymbol = 'ETH';
      const TokenA = Tokens[network][TokenASymbol];

      const TokenBSymbol = 'USDC';
      const TokenB = Tokens[network][TokenBSymbol];

      beforeEach(async () => {
        blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
        uniswapV4 = new UniswapV4(network, dexKey, dexHelper);
        await uniswapV4.initializePricing(blockNumber);
      });

      it('ETH -> USDC getPoolIdentifiers and getPricesVolume SELL', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[18],
          2n * BI_POWS[18],
          3n * BI_POWS[18],
          4n * BI_POWS[18],
          5n * BI_POWS[18],
          6n * BI_POWS[18],
          7n * BI_POWS[18],
          8n * BI_POWS[18],
          9n * BI_POWS[18],
          10n * BI_POWS[18],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        // const poolPrices = prices!.filter(
        //   pool =>
        //     pool!.poolIdentifier!.toLowerCase() ===
        //     '0xdce6394339af00981949f5f3baf27e3610c76326a700af57e4b3e3ae4977f78d'.toLowerCase(),
        // );

        // console.log(
        //   `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
        //   poolPrices,
        // );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('ETH -> USDC getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[6],
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          poolPrices,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> ETH getPoolIdentifiers and getPricesVolume SELL', async () => {
        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> ETH getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK: ', blockNumber);
        const amounts = [
          0n,
          2n * BI_POWS[18],
          3n * BI_POWS[18],
          4n * BI_POWS[18],
          5n * BI_POWS[18],
          6n * BI_POWS[18],
          7n * BI_POWS[18],
          8n * BI_POWS[18],
          9n * BI_POWS[18],
          10n * BI_POWS[18],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });
    });

    describe('USDC -> DAI', () => {
      const TokenASymbol = 'USDC';
      const TokenA = Tokens[network][TokenASymbol];

      const TokenBSymbol = 'DAI';
      const TokenB = Tokens[network][TokenBSymbol];

      beforeEach(async () => {
        blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
        uniswapV4 = new UniswapV4(network, dexKey, dexHelper);
        await uniswapV4.initializePricing(blockNumber);
      });

      it('USDC -> DAI getPoolIdentifiers and getPricesVolume SELL', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[6],
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> DAI getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[18],
          2n * BI_POWS[18],
          3n * BI_POWS[18],
          4n * BI_POWS[18],
          5n * BI_POWS[18],
          6n * BI_POWS[18],
          7n * BI_POWS[18],
          8n * BI_POWS[18],
          9n * BI_POWS[18],
          10n * BI_POWS[18],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        // const poolPrices = prices!.filter(
        //   pool =>
        //     pool!.poolIdentifier!.toLowerCase() ===
        //     '0xdce6394339af00981949f5f3baf27e3610c76326a700af57e4b3e3ae4977f78d'.toLowerCase(),
        // );

        // console.log(
        //   `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
        //   poolPrices,
        // );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('DAI -> USDC getPoolIdentifiers and getPricesVolume SELL', async () => {
        const amounts = [
          0n,
          2n * BI_POWS[18],
          3n * BI_POWS[18],
          4n * BI_POWS[18],
          5n * BI_POWS[18],
          6n * BI_POWS[18],
          7n * BI_POWS[18],
          8n * BI_POWS[18],
          9n * BI_POWS[18],
          10n * BI_POWS[18],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('DAI -> USDC getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK: ', blockNumber);
        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });
    });
  });

  describe('Base', () => {
    const network = Network.BASE;
    const dexHelper = new DummyDexHelper(network);

    let blockNumber: number;
    let uniswapV4: UniswapV4;

    describe('ETH -> USDC', () => {
      const TokenASymbol = 'ETH';
      const TokenA = Tokens[network][TokenASymbol];

      const TokenBSymbol = 'USDC';
      const TokenB = Tokens[network][TokenBSymbol];

      beforeEach(async () => {
        blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
        uniswapV4 = new UniswapV4(network, dexKey, dexHelper);
        await uniswapV4.initializePricing(blockNumber);
      });

      it('ETH -> USDC getPoolIdentifiers and getPricesVolume SELL', async () => {
        console.log('BLOCK: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[18],
          2n * BI_POWS[18],
          3n * BI_POWS[18],
          4n * BI_POWS[18],
          5n * BI_POWS[18],
          6n * BI_POWS[18],
          7n * BI_POWS[18],
          8n * BI_POWS[18],
          9n * BI_POWS[18],
          10n * BI_POWS[18],
          11n * BI_POWS[18],
          12n * BI_POWS[18],
          13n * BI_POWS[18],
          14n * BI_POWS[18],
          15n * BI_POWS[18],
          16n * BI_POWS[18],
          17n * BI_POWS[18],
          18n * BI_POWS[18],
          100n * BI_POWS[18],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('ETH -> USDC getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[6],
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> ETH getPoolIdentifiers and getPricesVolume SELL', async () => {
        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> ETH getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK: ', blockNumber);
        const amounts = [
          0n,
          2n * BI_POWS[18],
          3n * BI_POWS[18],
          4n * BI_POWS[18],
          5n * BI_POWS[18],
          6n * BI_POWS[18],
          7n * BI_POWS[18],
          8n * BI_POWS[18],
          9n * BI_POWS[18],
          10n * BI_POWS[18],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('ETH getTopPoolsForToken', async () => {
        const poolLiquidity = await uniswapV4.getTopPoolsForToken(
          TokenA.address,
          10,
        );
        console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

        if (!uniswapV4.hasConstantPriceLargeAmounts) {
          checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
        }
      });

      it('USDC getTopPoolsForToken', async () => {
        const poolLiquidity = await uniswapV4.getTopPoolsForToken(
          TokenB.address,
          10,
        );
        console.log(`${TokenASymbol} Top Pools:`, util.inspect(poolLiquidity));

        if (!uniswapV4.hasConstantPriceLargeAmounts) {
          checkPoolsLiquidity(poolLiquidity, TokenB.address, dexKey);
        }
      });
    });

    describe('USDC -> cbBTC', () => {
      const TokenASymbol = 'USDC';
      const TokenA = Tokens[network][TokenASymbol];

      const TokenBSymbol = 'cbBTC';
      const TokenB = Tokens[network][TokenBSymbol];

      beforeEach(async () => {
        blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
        uniswapV4 = new UniswapV4(network, dexKey, dexHelper);
        await uniswapV4.initializePricing(blockNumber);
      });

      it('USDC -> cbBTC getPoolIdentifiers and getPricesVolume SELL', async () => {
        const amounts = [
          0n,
          1n * BI_POWS[6],
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> cbBTC getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[8],
          2n * BI_POWS[8],
          3n * BI_POWS[8],
          4n * BI_POWS[8],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('cbBTC -> USDC getPoolIdentifiers and getPricesVolume SELL', async () => {
        const amounts = [
          0n,
          2n * BI_POWS[8],
          3n * BI_POWS[8],
          4n * BI_POWS[8],
          5n * BI_POWS[8],
          6n * BI_POWS[8],
          7n * BI_POWS[8],
          8n * BI_POWS[8],
          9n * BI_POWS[8],
          10n * BI_POWS[8],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('cbBTC -> USDC getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK: ', blockNumber);
        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });
    });
  });

  describe('Arbitrum', () => {
    const network = Network.ARBITRUM;
    const dexHelper = new DummyDexHelper(network);

    let blockNumber: number;
    let uniswapV4: UniswapV4;

    describe('WBTC -> USDC', () => {
      const TokenASymbol = 'WBTC';
      const TokenA = Tokens[network][TokenASymbol];

      const TokenBSymbol = 'USDC';
      const TokenB = Tokens[network][TokenBSymbol];

      beforeEach(async () => {
        blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
        uniswapV4 = new UniswapV4(network, dexKey, dexHelper);
        await uniswapV4.initializePricing(blockNumber);
      });

      it('WBTC -> USDC getPoolIdentifiers and getPricesVolume SELL', async () => {
        console.log('BLOCK: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[8],
          2n * BI_POWS[8],
          3n * BI_POWS[8],
          4n * BI_POWS[8],
          5n * BI_POWS[8],
          6n * BI_POWS[8],
          7n * BI_POWS[8],
          8n * BI_POWS[8],
          9n * BI_POWS[8],
          10n * BI_POWS[8],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('WBTC -> USDC getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[6],
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> WBTC getPoolIdentifiers and getPricesVolume SELL', async () => {
        const amounts = [
          0n,
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
          6n * BI_POWS[6],
          7n * BI_POWS[6],
          8n * BI_POWS[6],
          9n * BI_POWS[6],
          10n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('USDC -> WBTC getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK: ', blockNumber);
        const amounts = [
          0n,
          2n * BI_POWS[8],
          3n * BI_POWS[8],
          4n * BI_POWS[8],
          5n * BI_POWS[8],
          6n * BI_POWS[8],
          7n * BI_POWS[8],
          8n * BI_POWS[8],
          9n * BI_POWS[8],
          10n * BI_POWS[8],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });
    });

    describe('ETH -> WBTC', () => {
      const TokenASymbol = 'ETH';
      const TokenA = Tokens[network][TokenASymbol];

      const TokenBSymbol = 'WBTC';
      const TokenB = Tokens[network][TokenBSymbol];

      beforeEach(async () => {
        blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
        uniswapV4 = new UniswapV4(network, dexKey, dexHelper);
        await uniswapV4.initializePricing(blockNumber);
      });

      it('ETH -> WBTC getPoolIdentifiers and getPricesVolume SELL', async () => {
        console.log('BLOCK: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[18],
          2n * BI_POWS[18],
          3n * BI_POWS[18],
          4n * BI_POWS[18],
          5n * BI_POWS[18],
          6n * BI_POWS[18],
          7n * BI_POWS[18],
          8n * BI_POWS[18],
          9n * BI_POWS[18],
          10n * BI_POWS[18],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('ETH -> WBTC getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          1n * BI_POWS[6],
          2n * BI_POWS[6],
          3n * BI_POWS[6],
          4n * BI_POWS[6],
          5n * BI_POWS[6],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          util.inspect(poolPrices, false, null, true),
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('WBTC -> ETH getPoolIdentifiers and getPricesVolume SELL', async () => {
        const amounts = [
          0n,
          2n * BI_POWS[8],
          3n * BI_POWS[8],
          4n * BI_POWS[8],
          5n * BI_POWS[8],
          6n * BI_POWS[8],
          7n * BI_POWS[8],
          8n * BI_POWS[8],
          9n * BI_POWS[8],
          10n * BI_POWS[8],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.SELL,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.SELL,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactInputSingle',
              blockNumber,
              '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });

      it('WBTC -> ETH getPoolIdentifiers and getPricesVolume BUY', async () => {
        console.log('BLOCK: ', blockNumber);
        const amounts = [
          0n,
          2n * BI_POWS[18],
          3n * BI_POWS[18],
          4n * BI_POWS[18],
          5n * BI_POWS[18],
          6n * BI_POWS[18],
          7n * BI_POWS[18],
          8n * BI_POWS[18],
          9n * BI_POWS[18],
          10n * BI_POWS[18],
        ];

        const pools = await uniswapV4.getPoolIdentifiers(
          TokenB,
          TokenA,
          SwapSide.BUY,
          blockNumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await uniswapV4.getPricesVolume(
          TokenB,
          TokenA,
          amounts,
          SwapSide.BUY,
          blockNumber,
          pools,
        );

        console.log(
          `${TokenBSymbol} <> ${TokenASymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();

        let falseChecksCounter = 0;
        await Promise.all(
          poolPrices!.map(async price => {
            const res = await checkOnChainPricing(
              dexHelper,
              'quoteExactOutputSingle',
              blockNumber,
              '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
              price.prices,
              price.data.pool.key,
              price.data.zeroForOne,
              amounts,
            );
            if (res === false) falseChecksCounter++;
          }),
        );

        expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
      });
    });
  });
});
