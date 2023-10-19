import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { MaverickV1 } from './maverick-v1';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import PoolInspectorABI from '../../abi/maverick-v1/pool-inspector.json';

import { Tokens } from '../../../tests/constants-e2e';
import { MaverickV1Config } from './config';
import { ExchangePrices } from '../../types';
import { MaverickV1Data } from './types';

/*
  README
  ======

  This test script adds tests for MaverickV1 general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover MaverickV1 specific
  logic.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-integration.test.ts`

  (This comment should be removed from the final implementation)
*/

const network = Network.MAINNET;
const TokenASymbol = 'USDC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'USDT';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [0n, BI_POWS[6], 2000000n];

const dexHelper = new DummyDexHelper(network);
const dexKey = 'MaverickV1';

function getReaderCalldata(
  poolAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  tokenAIn: boolean,
  exactOutput: boolean,
) {
  return amounts.map(amount => ({
    target: MaverickV1Config[dexKey][network].poolInspectorAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      poolAddress,
      amount,
      tokenAIn,
      exactOutput,
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
  maverickV1: MaverickV1,
  funcName: string,
  blockNumber: number,
  pools: ExchangePrices<MaverickV1Data>,
  srcToken: string,
) {
  await Promise.all(
    pools.map(async pool => {
      const poolAddress = pool.data.pool;

      const readerIface = new Interface(PoolInspectorABI);

      const readerCallData = getReaderCalldata(
        poolAddress,
        readerIface,
        amounts.slice(1),
        'calculateSwap',
        pool.data.tokenA.toLowerCase() == srcToken.toLowerCase(),
        false,
      );
      const readerResult = (
        await dexHelper.multiContract.methods
          .aggregate(readerCallData)
          .call({}, blockNumber)
      ).returnData;

      const expectedPrices = [0n].concat(
        decodeReaderResult(readerResult, readerIface, funcName),
      );

      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} On Chain Prices: `,
        amounts,
        pool.prices,
        expectedPrices,
      );
      expect(pool.prices).toEqual(expectedPrices);
    }),
  );
}

describe('MaverickV1', function () {
  let blockNumber: number;
  let maverickV1: MaverickV1;

  beforeAll(async () => {
    blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();

    maverickV1 = new MaverickV1(network, dexKey, dexHelper);
    await maverickV1.initializePricing(blockNumber);
  });

  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const pools = await maverickV1.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );

    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await maverickV1.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (maverickV1.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    // Check if onchain pricing equals to calculated ones
    await checkOnChainPricing(
      maverickV1,
      'calculateSwap', // TODO: Put here the functionName to call
      blockNumber,
      poolPrices!,
      TokenA.address,
    );
  });
});
