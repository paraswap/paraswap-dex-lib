import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { AaveV1 } from './aave-v1';
import {
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

/*
  README
  ======

  This test script adds tests for AaveV1 general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover AaveV1 specific
  logic.

  You can run this individual test script by running:
  `npx jest src/dex/aave-v1/aave-v1-integration.tests.ts`

  (This comment should be removed from the final implementation)
*/

const network = Network.MAINNET;
const TokenASymbol = 'USDT';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'aUSDT';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  BigInt('0'),
  BigInt('1000000000000000000'),
  BigInt('2000000000000000000'),
];

const dexKey = 'AaveV1';

describe('AaveV1', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const aaveV1 = new AaveV1(network, dexKey, dexHelper);

    const pools = await aaveV1.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(
      `${TokenASymbol} <> ${TokenBSymbol} Pool Ideintifiers: `,
      pools,
    );

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await aaveV1.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );

    console.log('${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const aaveV1 = new AaveV1(network, dexKey, dexHelper);

    const pools = await aaveV1.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(
      `${TokenASymbol} <> ${TokenBSymbol} Pool Ideintifiers: `,
      pools,
    );

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await aaveV1.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log('${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const aaveV1 = new AaveV1(network, dexKey, dexHelper);

    const poolLiquidity = await aaveV1.getTopPoolsForToken(TokenA.address, 10);
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
  });
});
