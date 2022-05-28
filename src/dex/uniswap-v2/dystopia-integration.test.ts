import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { Dystopia } from './dystopia';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';

const WETH = {
  address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  decimals: 18,
};

const WMATIC = {
  address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  decimals: 18,
};

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'Dystopia';

describe('Dystopia', function () {
  it('getPoolIdentifiers and getPricesVolume', async function () {
    const dexHelper = new DummyDexHelper(Network.POLYGON);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const uniswapV2 = new Dystopia(Network.POLYGON, dexKey, dexHelper);

    const pools = await uniswapV2.getPoolIdentifiers(
      WETH,
      WMATIC,
      SwapSide.SELL,
      blocknumber,
    );
    console.log('WETH <> WMATIC Pool Identifiers: ', pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await uniswapV2.getPricesVolume(
      WETH,
      WMATIC,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log('WETH <> WMATIC Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(Network.POLYGON);
    const uniswapV2 = new Dystopia(Network.POLYGON, dexKey, dexHelper);

    const poolLiquidity = await uniswapV2.getTopPoolsForToken(WETH.address, 10);
    console.log('WETH Top Pools:', poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, WETH.address, dexKey);
  });
});
