import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { DystopiaStable } from './dystopia-stable';
// @ts-ignore
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';

const USDC = {
  address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  decimals: 6,
};

const USDT = {
  address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  decimals: 6,
};

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'DystopiaStable';

describe('DystopiaStable', function () {
  it('getPoolIdentifiers and getPricesVolume', async function () {
    const dexHelper = new DummyDexHelper(Network.POLYGON);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const uniswapV2 = new DystopiaStable(Network.POLYGON, dexKey, dexHelper);

    const pools = await uniswapV2.getPoolIdentifiers(
      USDC,
      USDT,
      SwapSide.SELL,
      blocknumber,
    );
    console.log('USDC <> USDT Pool Identifiers: ', pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await uniswapV2.getPricesVolume(
      USDC,
      USDT,
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
    const uniswapV2 = new DystopiaStable(Network.POLYGON, dexKey, dexHelper);

    const poolLiquidity = await uniswapV2.getTopPoolsForToken(USDC.address, 10);
    console.log('WETH Top Pools:', poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, USDC.address, dexKey);
  });
});
