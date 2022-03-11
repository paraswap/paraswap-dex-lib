import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { AaveV2 } from './aave-v2';
import { checkPoolsLiquidity, checkConstantPoolPrices } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { Tokens as AaveV2Tokens } from './tokens';
/*
  README
  ======

  This test script adds tests for AaveV2 general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover AaveV2 specific
  logic.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-integration.tests.ts`

  (This comment should be removed from the final implementation)
*/

const network = Network.MAINNET;
const TokenASymbol = 'USDT';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'aUSDT';
const TokenB = AaveV2Tokens[network][TokenBSymbol];

const amounts = [
  BigInt('0'),
  BigInt('1000000000000000000'),
  BigInt('2000000000000000000'),
];

const dexKey = 'AaveV2';

describe('AaveV2', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const aaveV2 = new AaveV2(network, dexKey, dexHelper);

    const pools = await aaveV2.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Ideintifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await aaveV2.getPricesVolume(
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
    const aaveV2 = new AaveV2(network, dexKey, dexHelper);

    const pools = await aaveV2.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Ideintifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await aaveV2.getPricesVolume(
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
    const aaveV2 = new AaveV2(network, dexKey, dexHelper);

    const poolLiquidity = await aaveV2.getTopPoolsForToken(
      TokenA.address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
  });
});
