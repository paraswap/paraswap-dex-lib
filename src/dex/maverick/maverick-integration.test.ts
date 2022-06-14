import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Maverick } from './maverick';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import EstimatorABI from '../../abi/maverick/estimator.json';
import { MaverickConfig } from './config';
import { ExchangePrices } from '../../types';
import { MaverickData } from './types';

const network = Network.POLYGON;
const TokenASymbol = 'WETH';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'USDC';
const TokenB = Tokens[network][TokenBSymbol];
const dexHelper = new DummyDexHelper(network);

const amounts = [0n, 500000000000000000n, BI_POWS[18]];

const dexKey = 'Maverick';

function getReaderCalldata(
  poolAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  swapForBase: boolean,
) {
  return amounts.map(amount => ({
    target: MaverickConfig[dexKey][network].estimatorAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      poolAddress,
      amount,
      swapForBase,
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
  maverick: Maverick,
  funcName: string,
  blockNumber: number,
  pools: ExchangePrices<MaverickData>,
  srcToken: string,
) {
  await Promise.all(
    pools.map(async pool => {
      const poolAddress = pool.data.pool;

      const readerIface = new Interface(EstimatorABI);

      const readerCallData = getReaderCalldata(
        poolAddress,
        readerIface,
        amounts.slice(1),
        funcName,
        pool.data.quote.toLowerCase() == srcToken.toLowerCase(),
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

describe('Maverick', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blockNumber = await dexHelper.provider.getBlockNumber();
    const maverick = new Maverick(network, dexKey, dexHelper);
    await maverick.initializePricing(blockNumber);

    const pools = await maverick.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blockNumber,
    );

    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await maverick.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (maverick.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }

    await checkOnChainPricing(
      maverick,
      'swap',
      blockNumber,
      poolPrices!,
      TokenA.address,
    );
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const maverick = new Maverick(network, dexKey, dexHelper);
    const poolLiquidity = await maverick.getTopPoolsForToken(
      TokenA.address,
      10,
    );

    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!maverick.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});
