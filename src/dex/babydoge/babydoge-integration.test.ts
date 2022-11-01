import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { BabydogeSwap } from './babydoge';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';

/*
  README
  ======
  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-integration.test.ts`
  (This comment should be removed from the final implementation)
*/

const network = Network.BSC;

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'Babydoge';

const WBNB = {
  address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  decimals: 18,
};

const BABYDOGE = {
  address: '0xc748673057861a797275CD8A068AbB95A902e8de',
  decimals: 9,
};

describe('BabydogeSwap', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const babydogeswap = new BabydogeSwap(network, dexKey, dexHelper);

    const pools = await babydogeswap.getPoolIdentifiers(
      WBNB,
      BABYDOGE,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`WBNB <> BABYDOGE Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await babydogeswap.getPricesVolume(
      WBNB,
      BABYDOGE,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`WBNB <> BABYDOGE Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const babydogeswap = new BabydogeSwap(network, dexKey, dexHelper);

    const pools = await babydogeswap.getPoolIdentifiers(
      WBNB,
      BABYDOGE,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(`WBNB <> BABYDOGE Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await babydogeswap.getPricesVolume(
      WBNB,
      BABYDOGE,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log(`WBNB <> BABYDOGE Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const babydogeswap = new BabydogeSwap(network, dexKey, dexHelper);

    const poolLiquidity = await babydogeswap.getTopPoolsForToken(
      WBNB.address,
      10,
    );
    console.log(`WBNB Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, WBNB.address, dexKey);
  });
});
