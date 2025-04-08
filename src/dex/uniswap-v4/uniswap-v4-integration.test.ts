/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();
import { DummyDexHelper, IDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { UniswapV4 } from './uniswap-v4';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';
import { checkPoolPrices } from '../../../tests/utils';
import { Interface, Result } from '@ethersproject/abi';
import QuoterAbi from '../../abi/uniswap-v4/quoter.abi.json';
import { PoolKey } from './types';

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
      `Can not fetch on-chain pricing for pool ${poolKey.toString()}. It happens for low liquidity pools`,
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
  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);
    const dexKey = 'UniswapV4';

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
        checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

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
        checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

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
        const amounts = [
          0n,
          2n * BI_POWS[17],
          3n * BI_POWS[17],
          // 4n * BI_POWS[18],
          // 5n * BI_POWS[18],
          // 6n * BI_POWS[18],
          // 7n * BI_POWS[18],
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
        checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

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

    describe('USDC -> USDT', () => {
      const TokenASymbol = 'USDC';
      const TokenA = Tokens[network][TokenASymbol];

      const TokenBSymbol = 'USDT';
      const TokenB = Tokens[network][TokenBSymbol];

      beforeEach(async () => {
        blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
        // blockNumber = 22187895;
        uniswapV4 = new UniswapV4(network, dexKey, dexHelper);
      });

      it('USDC -> USDT getPoolIdentifiers and getPricesVolume SELL', async () => {
        console.log('BLOCK NUMBER: ', blockNumber);

        const amounts = [
          0n,
          2n * BI_POWS[6],
          // 3n * BI_POWS[6],
          // 4n * BI_POWS[6],
          // 5n * BI_POWS[6],
          // 6n * BI_POWS[6],
          // 7n * BI_POWS[6],
          // 8n * BI_POWS[6],
          // 9n * BI_POWS[6],
          // 11n * BI_POWS[6],
          // 12n * BI_POWS[6],
          // 13n * BI_POWS[6],
          // 14n * BI_POWS[6],
          // 15n * BI_POWS[6],
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
    });
  });
});
