/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();
import { SushiSwapV3 } from '../sushiswap-v3/sushiswap-v3';
import { Network, SwapSide } from '../../constants';
import { DummyDexHelper, IDexHelper } from '../../dex-helper';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Interface, Result } from '@ethersproject/abi';
import SushiswapV3QuoterV2ABI from '../../abi/sushiswap-v3/QuoterV2.json';
import { Address } from '@paraswap/core';

const quoterIface = new Interface(SushiswapV3QuoterV2ABI);

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  tokenIn: Address,
  tokenOut: Address,
  fee: bigint,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      [tokenIn, tokenOut, amount.toString(), fee.toString(), 0],
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
  sushiSwapV3: SushiSwapV3,
  funcName: string,
  blockNumber: number,
  exchangeAddress: string,
  prices: bigint[],
  tokenIn: Address,
  tokenOut: Address,
  fee: bigint,
  _amounts: bigint[],
) {
  // Quoter address
  // const exchangeAddress = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
  const readerIface = quoterIface;

  // const sum = prices.reduce((acc, curr) => (acc += curr), 0n);
  //
  // if (sum === 0n) {
  //   console.log(
  //     `Prices were not calculated for tokenIn=${tokenIn}, tokenOut=${tokenOut}, fee=${fee.toString()}. Most likely price impact is too big for requested amount`,
  //   );
  //   return false;
  // }

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    _amounts.slice(1),
    funcName,
    tokenIn,
    tokenOut,
    fee,
  );

  let readerResult;
  try {
    readerResult = (
      await dexHelper.multiContract.methods
        .aggregate(readerCallData)
        .call({}, blockNumber)
    ).returnData;
  } catch (e) {
    console.log(
      `Can not fetch on-chain pricing for fee ${fee}. It happens for low liquidity pools`,
      e,
    );
    return false;
  }

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  console.log('EXPECTED PRICES: ', expectedPrices);

  let firstZeroIndex = prices.slice(1).indexOf(0n);

  // we skipped first, so add +1 on result
  firstZeroIndex = firstZeroIndex === -1 ? prices.length : firstZeroIndex;

  // Compare only the ones for which we were able to calculate prices
  expect(prices.slice(0, firstZeroIndex)).toEqual(
    expectedPrices.slice(0, firstZeroIndex),
  );
  return true;
}

describe('SushiSwapV3', () => {
  const dexKey = 'SushiSwapV3';

  describe('Mainnet', () => {
    let blockNumber: number;
    let sushiSwapV3: SushiSwapV3;
    let sushiSwapV3Mainnet: SushiSwapV3;

    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);
    const TokenASymbol = 'USDC';
    const TokenA = Tokens[network][TokenASymbol];

    const TokenBSymbol = 'USDT';
    const TokenB = Tokens[network][TokenBSymbol];

    beforeEach(async () => {
      blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      sushiSwapV3 = new SushiSwapV3(network, dexKey, dexHelper);
      sushiSwapV3Mainnet = new SushiSwapV3(Network.MAINNET, dexKey, dexHelper);
    });

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      const amounts = [0n, BI_POWS[6], 2000000n];

      const pools = await sushiSwapV3.getPoolIdentifiers(
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

      const poolPrices = await sushiSwapV3.getPricesVolume(
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
          const fee = sushiSwapV3.eventPools[price.poolIdentifier!]!.feeCode;
          const res = await checkOnChainPricing(
            dexHelper,
            sushiSwapV3,
            'quoteExactInputSingle',
            blockNumber,
            '0x64e8802FE490fa7cc61d3463958199161Bb608A7',
            price.prices,
            TokenA.address,
            TokenB.address,
            fee,
            amounts,
          );
          if (res === false) falseChecksCounter++;
        }),
      );

      expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      const amounts = [0n, BI_POWS[6], 2000000n];

      const pools = await sushiSwapV3.getPoolIdentifiers(
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

      const poolPrices = await sushiSwapV3.getPricesVolume(
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
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

      let falseChecksCounter = 0;
      await Promise.all(
        poolPrices!.map(async price => {
          const fee = sushiSwapV3.eventPools[price.poolIdentifier!]!.feeCode;
          const res = await checkOnChainPricing(
            dexHelper,
            sushiSwapV3,
            'quoteExactOutputSingle',
            blockNumber,
            '0x64e8802FE490fa7cc61d3463958199161Bb608A7',
            price.prices,
            TokenA.address,
            TokenB.address,
            fee,
            amounts,
          );
          if (res === false) falseChecksCounter++;
        }),
      );

      expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
    });

    it('getTopPoolsForToken', async function () {
      const poolLiquidity = await sushiSwapV3.getTopPoolsForToken(
        TokenB.address,
        10,
      );
      console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, TokenB.address, dexKey);
    });
  });

  describe('Arbitrum', () => {
    let blockNumber: number;
    let sushiSwapV3: SushiSwapV3;
    let sushiSwapV3Mainnet: SushiSwapV3;

    const network = Network.ARBITRUM;
    const dexHelper = new DummyDexHelper(network);
    const TokenASymbol = 'USDCe';
    const TokenA = Tokens[network][TokenASymbol];

    const TokenBSymbol = 'USDT';
    const TokenB = Tokens[network][TokenBSymbol];

    beforeEach(async () => {
      // blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      blockNumber = 125789437;
      sushiSwapV3 = new SushiSwapV3(network, dexKey, dexHelper);
      sushiSwapV3Mainnet = new SushiSwapV3(Network.ARBITRUM, dexKey, dexHelper);
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      const amounts = [0n, 100000000n, 200000000n];

      const pools = await sushiSwapV3.getPoolIdentifiers(
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

      const poolPrices = await sushiSwapV3.getPricesVolume(
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
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

      let falseChecksCounter = 0;
      await Promise.all(
        poolPrices!.map(async price => {
          const fee = sushiSwapV3.eventPools[price.poolIdentifier!]!.feeCode;
          const res = await checkOnChainPricing(
            dexHelper,
            sushiSwapV3,
            'quoteExactOutputSingle',
            blockNumber,
            '0x0524E833cCD057e4d7A296e3aaAb9f7675964Ce1',
            price.prices,
            TokenA.address,
            TokenB.address,
            fee,
            amounts,
          );
          if (res === false) falseChecksCounter++;
        }),
      );

      expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
    });

  });
});
