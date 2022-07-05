import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { HodltreeFlashloanExchange } from './hodltree-flashloan-exchange';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { HodltreeFlashloanExchangeConfig } from './config';

/*
  README
  ======

  This test script adds tests for HodltreeFlashloanExchange general integration 
  with the DEX interface. The test cases below are example tests. 
  It is recommended to add tests which cover HodltreeFlashloanExchange specific
  logic. 

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-integration.test.ts`

  (This comment should be removed from the final implementation)
*/

const network = Network.ROPSTEN;
const TokenASymbol = 'USDC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'USDT';
const TokenB = Tokens[network][TokenBSymbol];

const sellAmounts = [BigInt('0'), BigInt('100000000'), BigInt('150000000')];
const buyAmounts = [BigInt('0'), BigInt('100000000'), BigInt('200000001')];

const dexKey = 'HodltreeFlashloanExchange';

describe('HodltreeFlashloanExchange', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const hodltreeFlashloanExchange = new HodltreeFlashloanExchange(
      network,
      dexKey,
      dexHelper,
      HodltreeFlashloanExchangeConfig.HodltreeFlashloanExchange[
        network
      ].exchange,
      HodltreeFlashloanExchangeConfig.HodltreeFlashloanExchange[network].pools,
    );

    await hodltreeFlashloanExchange.setupEventPools(blocknumber);

    const pools = await hodltreeFlashloanExchange.getPoolIdentifiers(
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

    const poolPrices = await hodltreeFlashloanExchange.getPricesVolume(
      TokenA,
      TokenB,
      sellAmounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log('${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, sellAmounts, SwapSide.SELL, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const hodltreeFlashloanExchange = new HodltreeFlashloanExchange(
      network,
      dexKey,
      dexHelper,
      HodltreeFlashloanExchangeConfig.HodltreeFlashloanExchange[
        network
      ].exchange,
      HodltreeFlashloanExchangeConfig.HodltreeFlashloanExchange[network].pools,
    );

    await hodltreeFlashloanExchange.setupEventPools(blocknumber);

    const pools = await hodltreeFlashloanExchange.getPoolIdentifiers(
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

    const poolPrices = await hodltreeFlashloanExchange.getPricesVolume(
      TokenA,
      TokenB,
      buyAmounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log('${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, buyAmounts, SwapSide.BUY, dexKey);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const hodltreeFlashloanExchange = new HodltreeFlashloanExchange(
      network,
      dexKey,
      dexHelper,
      HodltreeFlashloanExchangeConfig.HodltreeFlashloanExchange[
        network
      ].exchange,
      HodltreeFlashloanExchangeConfig.HodltreeFlashloanExchange[network].pools,
    );

    await hodltreeFlashloanExchange.setupEventPools(blocknumber);

    const poolLiquidity = await hodltreeFlashloanExchange.getTopPoolsForToken(
      TokenA.address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
  });
});
