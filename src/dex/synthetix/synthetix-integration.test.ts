import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Synthetix } from './synthetix';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { dexPriceAggregatorUniswapV3 } from './contract-math/DexPriceAggregatorUniswapV3';

const network = Network.MAINNET;
const TokenASymbol = 'sBTC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'sETH';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  0n,
  1n * BI_POWS[TokenA.decimals],
  2n * BI_POWS[TokenA.decimals],
  3n * BI_POWS[TokenA.decimals],
  4n * BI_POWS[TokenA.decimals],
  5n * BI_POWS[TokenA.decimals],
  6n * BI_POWS[TokenA.decimals],
  7n * BI_POWS[TokenA.decimals],
  8n * BI_POWS[TokenA.decimals],
  9n * BI_POWS[TokenA.decimals],
];

const dexHelper = new DummyDexHelper(network);
const dexKey = 'Synthetix';

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
  synthetix: Synthetix,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
) {
  const exchangeAddress = ''; // TODO: Put here the real exchange address

  // TODO: Replace dummy interface with the real one
  // Normally you can get it from synthetix.Iface or from eventPool.
  // It depends on your implementation
  const readerIface = new Interface('');

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

describe('Synthetix', function () {
  let blockNumber: number;
  let synthetix: Synthetix;

  beforeAll(async () => {
    blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    synthetix = new Synthetix(network, dexKey, dexHelper);
    await synthetix.initializePricing(blockNumber);
  });

  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const pools = await synthetix.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await synthetix.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (synthetix.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    // Check if onchain pricing equals to calculated ones
    await checkOnChainPricing(
      synthetix,
      '', // TODO: Put here the functionName to call
      blockNumber,
      poolPrices![0].prices,
    );
  });

  it('getTopPoolsForToken', async function () {
    const poolLiquidity = await synthetix.getTopPoolsForToken(
      TokenA.address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!synthetix.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });

  it('Compute UniswapV3 address from token0, token1, fee in _computeAddress', async function () {
    const uniswapV3Factory = '0x1f98431c8ad98523631ae4a59f267346ea31f984';
    const computed = dexPriceAggregatorUniswapV3._computeAddress(
      uniswapV3Factory,
      {
        token0: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        token1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        fee: 500n,
      },
    );
    expect(computed).toEqual('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640');
  });
});
