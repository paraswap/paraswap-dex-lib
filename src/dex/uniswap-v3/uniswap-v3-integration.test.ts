import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { UniswapV3 } from './uniswap-v3';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import UniswapV3QuoterABI from '../../abi/uniswap-v3/UniswapV3Quoter.abi.json';
import { Address } from 'paraswap-core';

const network = Network.POLYGON;
const TokenASymbol = 'USDC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'WMATIC';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  0n,
  100_000_000n * BI_POWS[6],
  200_000_000n * BI_POWS[6],
  300_000_000n * BI_POWS[6],
];

const amountsBuy = [0n, 1n * BI_POWS[18], 2n * BI_POWS[18], 3n * BI_POWS[18]];

const dexHelper = new DummyDexHelper(network);
const dexKey = 'UniswapV3';

const quoterIface = new Interface(UniswapV3QuoterABI);

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  tokenIn: Address,
  tokenOut: Address,
  fee: bigint,
  _amounts: bigint[],
) {
  return _amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      tokenIn,
      tokenOut,
      fee,
      amount,
      0n,
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
  uniswapV3: UniswapV3,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  tokenIn: Address,
  tokenOut: Address,
  fee: bigint,
  _amounts: bigint[],
) {
  // Quoter address
  const exchangeAddress = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
  const readerIface = quoterIface;

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    readerIface,
    amounts.slice(1),
    funcName,
    tokenIn,
    tokenOut,
    fee,
    _amounts,
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
    return;
  }

  const expectedPrices = [0n].concat(
    decodeReaderResult(readerResult, readerIface, funcName),
  );

  expect(prices).toEqual(expectedPrices);
}

describe('UniswapV3', function () {
  let blockNumber: number;
  let uniswapV3: UniswapV3;
  let uniswapV3Mainnet: UniswapV3;

  beforeAll(async () => {
    blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    uniswapV3 = new UniswapV3(network, dexKey, dexHelper);
    uniswapV3Mainnet = new UniswapV3(
      Network.MAINNET,
      dexKey,
      new DummyDexHelper(Network.MAINNET),
    );
  });

  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const pools = await uniswapV3.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await uniswapV3.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (uniswapV3.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    await Promise.all(
      poolPrices!.map(async price => {
        const fee = uniswapV3.eventPools[price.poolIdentifier!]!.feeCode;
        await checkOnChainPricing(
          uniswapV3,
          'quoteExactInputSingle',
          blockNumber,
          price.prices,
          TokenA.address,
          TokenB.address,
          fee,
          amounts,
        );
      }),
    );
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const pools = await uniswapV3.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await uniswapV3.getPricesVolume(
      TokenA,
      TokenB,
      amountsBuy,
      SwapSide.BUY,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (uniswapV3.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey);
    }

    // Check if onchain pricing equals to calculated ones
    await Promise.all(
      poolPrices!.map(async price => {
        const fee = uniswapV3.eventPools[price.poolIdentifier!]!.feeCode;
        await checkOnChainPricing(
          uniswapV3,
          'quoteExactOutputSingle',
          blockNumber,
          price.prices,
          TokenA.address,
          TokenB.address,
          fee,
          amountsBuy,
        );
      }),
    );
  });

  it('getTopPoolsForToken', async function () {
    const poolLiquidity = await uniswapV3Mainnet.getTopPoolsForToken(
      Tokens[Network.MAINNET]['USDC'].address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!uniswapV3.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});
