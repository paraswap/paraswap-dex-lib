/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { DfynV2 } from './dfyn-v2';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import DfynV2QuoterAbi from '../../abi/dfyn-v2/DfynV2Quoter.abi.json';
import { Address } from '@paraswap/core';
import { debug } from 'console';

const network = Network.POLYGON;
const TokenASymbol = 'USDC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'DFYN';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [0n, 10n * BI_POWS[6],20n * BI_POWS[6],30n * BI_POWS[6]]

const amountsBuy = [0n, 1n * BI_POWS[18]];

const dexHelper = new DummyDexHelper(network);
const dexKey = 'DfynV2';

const quoterIface = new Interface(DfynV2QuoterAbi);

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  tokenIn: Address,
  tokenOut: Address,
  // fee: bigint,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      tokenIn.concat(tokenOut.slice(2)),
      amount.toString(),
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
  dfynV2: DfynV2,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  tokenIn: Address,
  tokenOut: Address,
  // fee: bigint,
  _amounts: bigint[],
) {
  
  // Quoter address
  const exchangeAddress = '0xeE4545ABC69C17Bbc48971E4be98D35626Bd8793';
  const readerIface = quoterIface;

  const sum = prices.reduce((acc, curr) => (acc += curr), 0n);

  if (sum === 0n) {
    console.log(
      `Prices were not calculated for tokenIn=${tokenIn}, tokenOut=${tokenOut}. Most likely price impact is too big for requested amount`,
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
    // fee,
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
      `Can not fetch on-chain pricing for fee. It happens for low liquidity pools`,
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

describe('DfynV2', function () {
  let blockNumber: number;
  let dfynV2: DfynV2;
  let dfynV2Mainnet: DfynV2;

  beforeEach(async () => {
    blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    dfynV2 = new DfynV2(network, dexKey, dexHelper);
    dfynV2Mainnet = new DfynV2(
      Network.POLYGON,
      dexKey,
      new DummyDexHelper(Network.POLYGON),
    );
  });

  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    
    const pools = await dfynV2.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );
 
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);
    
    const poolPrices = await dfynV2.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);
    
    
    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    
    let falseChecksCounter = 0;
    await Promise.all(
      poolPrices!.map(async price => {
        const res = await checkOnChainPricing(
          dfynV2,
          'quoteExactInput',
          blockNumber,
          price.prices,
          TokenA.address,
          TokenB.address,
          amounts,
        );
        if (res === false) falseChecksCounter++;
      }),
    );

    expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const pools = await dfynV2.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);
    
    const poolPrices = await dfynV2.getPricesVolume(
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
        const res = await checkOnChainPricing(
          dfynV2,
          'quoteExactOutput',
          blockNumber,
          price.prices,
          TokenB.address,
          TokenA.address,
          amountsBuy,
        );
        if (res === false) falseChecksCounter++;
      }),
    );
    expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
  });

  it('getPoolIdentifiers and getPricesVolume SELL stable pairs', async function () {
    const TokenASymbol = 'USDC';
    const TokenA = Tokens[network][TokenASymbol];

    const TokenBSymbol = 'USDT';
    const TokenB = Tokens[network][TokenBSymbol];

    const amounts = [
      0n,
      6000000n,
      12000000n,
      18000000n,
      24000000n,
      30000000n,
    ];

    const pools = await dfynV2.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);
    
    const poolPrices = await dfynV2.getPricesVolume(
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
        //const fee = dfynV2.eventPools[price.poolIdentifier!]!.feeCode;
        const res = await checkOnChainPricing(
          dfynV2,
          'quoteExactInput',
          blockNumber,
          price.prices,
          TokenA.address,
          TokenB.address,
          //fee,
          amounts,
        );
        if (res === false) falseChecksCounter++;
      }),
    );
    expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
  });

  it('getPoolIdentifiers and getPricesVolume BUY stable pairs', async function () {
    const TokenASymbol = 'USDC';
    const TokenA = Tokens[network][TokenASymbol];

    const TokenBSymbol = 'USDT';
    const TokenB = Tokens[network][TokenBSymbol];

    const amountsBuy = [
      0n,
      6000000n,
      // 12000000n,
      // 18000000n,
      // 24000000n,
      // 30000000n,
    ];

    const pools = await dfynV2.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await dfynV2.getPricesVolume(
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
        //const fee = dfynV2.eventPools[price.poolIdentifier!]!.feeCode;
        const res = await checkOnChainPricing(
          dfynV2,
          'quoteExactOutput',
          blockNumber,
          price.prices,
          TokenB.address,
          TokenA.address,
          //fee,
          amountsBuy,
        );
        if (res === false) falseChecksCounter++;
      }),
    );
    expect(falseChecksCounter).toBeLessThan(poolPrices!.length);
  });

  it('getTopPoolsForToken', async function () {
    const poolLiquidity = await dfynV2Mainnet.getTopPoolsForToken(
      Tokens[Network.POLYGON]['USDC'].address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!dfynV2.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});
