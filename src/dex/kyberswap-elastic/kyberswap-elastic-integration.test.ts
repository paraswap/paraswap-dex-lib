/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { Address } from '@paraswap/core';

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { KyberswapElastic } from './kyberswap-elastic';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import QuoterV2ABI from '../../abi/kyberswap-elastic/IQuoterV2.json';
import { KyberElasticFunctions } from './types';
import { KyberswapElasticConfig } from './config';

const network = Network.POLYGON;
const TokenASymbol = 'USDC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'WMATIC';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  0n,
  10_000n * BI_POWS[6],
  20_000n * BI_POWS[6],
  30_000n * BI_POWS[6],
];

const amountsBuy = [0n, 1n * BI_POWS[18], 2n * BI_POWS[18], 3n * BI_POWS[18]];

const dexHelper = new DummyDexHelper(network);
const dexKey = 'KyberswapElastic';

const quoterIface = new Interface(QuoterV2ABI);

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  tokenIn: Address,
  tokenOut: Address,
  swapFeeUnits: bigint,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      funcName == KyberElasticFunctions.quoteExactInputSingle
        ? {
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amount,
            feeUnits: swapFeeUnits,
            limitSqrtP: 0n,
          }
        : {
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amount: amount,
            feeUnits: swapFeeUnits,
            limitSqrtP: 0n,
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
    return BigInt(parsed[0][1]._hex);
  });
}

async function checkOnChainPricing(
  kyberswapElastic: KyberswapElastic,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  tokenIn: Address,
  tokenOut: Address,
  swapFeeUnits: bigint,
  _amounts: bigint[],
) {
  // Quoter address
  const exchangeAddress = KyberswapElasticConfig[dexKey][network].quoter;
  const readerIface = quoterIface;

  const sum = prices.reduce((acc, curr) => (acc += curr), 0n);

  if (sum === 0n) {
    console.log(
      `Prices were not calculated for tokenIn=${tokenIn}, tokenOut=${tokenOut}, swapFeeUnits=${swapFeeUnits.toString()}. Most likely price impact is too big for requested amount`,
    );
    return false;
  }

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    _amounts.slice(1),
    funcName,
    tokenIn,
    tokenOut,
    swapFeeUnits,
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
      `Can not fetch on-chain pricing for swapFeeUnits ${swapFeeUnits}. It happens for low liquidity pools`,
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

  // Compare only the ones for which we were able to calculate prices
  expect(prices.slice(0, firstZeroIndex)).toEqual(
    expectedPrices.slice(0, firstZeroIndex),
  );
  return true;
}

describe('KyberswapElastic', function () {
  let blockNumber: number;
  let kyberswapElastic: KyberswapElastic;
  let kyberswapElasticMainnet: KyberswapElastic;

  beforeEach(async () => {
    blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    kyberswapElastic = new KyberswapElastic(network, dexKey, dexHelper);
    kyberswapElasticMainnet = new KyberswapElastic(
      Network.MAINNET,
      dexKey,
      new DummyDexHelper(Network.MAINNET),
    );
  });

  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const pools = await kyberswapElastic.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await kyberswapElastic.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    // console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

    let falseChecksCounter = 0;
    await Promise.all(
      poolPrices!.map(async price => {
        const swapFeeUnits =
          kyberswapElastic.eventPools[price.poolIdentifier!]!.swapFeeUnits;
        const res = await checkOnChainPricing(
          kyberswapElastic,
          KyberElasticFunctions.quoteExactInputSingle,
          blockNumber,
          price.prices,
          TokenA.address,
          TokenB.address,
          swapFeeUnits,
          amounts,
        );
        if (res === false) falseChecksCounter++;
      }),
    );

    expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const pools = await kyberswapElastic.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await kyberswapElastic.getPricesVolume(
      TokenA,
      TokenB,
      amountsBuy,
      SwapSide.BUY,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amountsBuy, SwapSide.BUY, dexKey);

    // Check if onchain pricing equals to calculated ones
    let falseChecksCounter = 0;
    await Promise.all(
      poolPrices!.map(async price => {
        const swapFeeUnits =
          kyberswapElastic.eventPools[price.poolIdentifier!]!.swapFeeUnits;
        const res = await checkOnChainPricing(
          kyberswapElastic,
          KyberElasticFunctions.quoteExactOutputSingle,
          blockNumber,
          price.prices,
          TokenB.address,
          TokenA.address,
          swapFeeUnits,
          amountsBuy,
        );
        if (res === false) falseChecksCounter++;
      }),
    );
    expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
  });

  it('getPoolIdentifiers and getPricesVolume SELL stable pairs', async function () {
    const TokenASymbol = 'USDT';
    const TokenA = Tokens[network][TokenASymbol];

    const TokenBSymbol = 'USDC';
    const TokenB = Tokens[network][TokenBSymbol];

    const amounts = [
      0n,
      6000000n,
      12000000n,
      18000000n,
      24000000n,
      30000000n,
      36000000n,
      42000000n,
      48000000n,
      54000000n,
      60000000n,
      66000000n,
      72000000n,
      78000000n,
      84000000n,
      90000000n,
      96000000n,
      102000000n,
      108000000n,
      114000000n,
      120000000n,
      126000000n,
      132000000n,
      138000000n,
      144000000n,
      150000000n,
      156000000n,
      162000000n,
      168000000n,
      174000000n,
      180000000n,
      186000000n,
      192000000n,
      198000000n,
      204000000n,
      210000000n,
      216000000n,
      222000000n,
      228000000n,
      234000000n,
      240000000n,
      246000000n,
      252000000n,
      258000000n,
      264000000n,
      270000000n,
      276000000n,
      282000000n,
      288000000n,
      294000000n,
      300000000n,
    ];

    const pools = await kyberswapElastic.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await kyberswapElastic.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(
      poolPrices!.filter(pp => pp.unit !== 0n),
      amounts,
      SwapSide.SELL,
      dexKey,
    );

    // Check if onchain pricing equals to calculated ones
    let falseChecksCounter = 0;
    await Promise.all(
      poolPrices!.map(async price => {
        const swapFeeUnits =
          kyberswapElastic.eventPools[price.poolIdentifier!]!.swapFeeUnits;
        const res = await checkOnChainPricing(
          kyberswapElastic,
          KyberElasticFunctions.quoteExactInputSingle,
          blockNumber,
          price.prices,
          TokenA.address,
          TokenB.address,
          swapFeeUnits,
          amounts,
        );
        if (res === false) falseChecksCounter++;
      }),
    );
    expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
  });

  it('getPoolIdentifiers and getPricesVolume BUY stable pairs', async function () {
    const TokenASymbol = 'USDT';
    const TokenA = Tokens[network][TokenASymbol];

    const TokenBSymbol = 'USDC';
    const TokenB = Tokens[network][TokenBSymbol];

    const amountsBuy = [
      0n,
      6000000n,
      12000000n,
      18000000n,
      24000000n,
      30000000n,
      36000000n,
      42000000n,
      48000000n,
      54000000n,
      60000000n,
      66000000n,
      72000000n,
      78000000n,
      84000000n,
      90000000n,
      96000000n,
      102000000n,
      108000000n,
      114000000n,
      120000000n,
      126000000n,
      132000000n,
      138000000n,
      144000000n,
      150000000n,
      156000000n,
      162000000n,
      168000000n,
      174000000n,
      180000000n,
      186000000n,
      192000000n,
      198000000n,
      204000000n,
      210000000n,
      216000000n,
      222000000n,
      228000000n,
      234000000n,
      240000000n,
      246000000n,
      252000000n,
      258000000n,
      264000000n,
      270000000n,
      276000000n,
      282000000n,
      288000000n,
      294000000n,
      300000000n,
    ];

    const pools = await kyberswapElastic.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await kyberswapElastic.getPricesVolume(
      TokenA,
      TokenB,
      amountsBuy,
      SwapSide.BUY,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(
      poolPrices!.filter(pp => pp.unit !== 0n),
      amountsBuy,
      SwapSide.BUY,
      dexKey,
    );

    // Check if onchain pricing equals to calculated ones
    let falseChecksCounter = 0;
    await Promise.all(
      poolPrices!.map(async price => {
        const swapFeeUnits =
          kyberswapElastic.eventPools[price.poolIdentifier!]!.swapFeeUnits;
        const res = await checkOnChainPricing(
          kyberswapElastic,
          KyberElasticFunctions.quoteExactOutputSingle,
          blockNumber,
          price.prices,
          TokenB.address,
          TokenA.address,
          swapFeeUnits,
          amountsBuy,
        );
        if (res === false) falseChecksCounter++;
      }),
    );
    expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
  });

  it('getTopPoolsForToken', async function () {
    const poolLiquidity = await kyberswapElasticMainnet.getTopPoolsForToken(
      Tokens[Network.MAINNET]['USDC'].address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!kyberswapElastic.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});
