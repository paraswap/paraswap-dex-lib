import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { UniswapV2 } from './uniswap-v2';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_0, BI_POW_18 } from '../../bigint-constants';

const WETH = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  decimals: 18,
};

const DAI = {
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  decimals: 18,
};

const amounts = [BI_0, BI_POW_18, BigInt('2000000000000000000')];

const dexKey = 'UniswapV2';

describe('UniswapV2', function () {
  it('getPoolIdentifiers and getPricesVolume', async function () {
    const dexHelper = new DummyDexHelper(Network.MAINNET);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const uniswapV2 = new UniswapV2(Network.MAINNET, dexKey, dexHelper);

    const pools = await uniswapV2.getPoolIdentifiers(
      WETH,
      DAI,
      SwapSide.SELL,
      blocknumber,
    );
    console.log('WETH <> DAI Pool Identifiers: ', pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await uniswapV2.getPricesVolume(
      WETH,
      DAI,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log('WETH <> DAI Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(Network.MAINNET);
    const uniswapV2 = new UniswapV2(Network.MAINNET, dexKey, dexHelper);

    const poolLiquidity = await uniswapV2.getTopPoolsForToken(WETH.address, 10);
    console.log('WETH Top Pools:', poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, WETH.address, dexKey);
  });
});
