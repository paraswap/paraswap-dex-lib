import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { UniswapV2 } from './uniswap-v2';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';
import { Dystopia } from './dystopia/dystopia';
import { DystopiaStable } from './dystopia/dystopia-stable';
import { Tokens } from '../../../tests/constants-e2e';

const WETH = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  decimals: 18,
};

const DAI = {
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  decimals: 18,
};

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

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

describe('Dystopia', function () {
  describe('UniswapV2 like pool', function () {
    const dexKey = 'Dystopia';
    const TokenASymbol = 'WETH';
    const tokenA = Tokens[Network.POLYGON][TokenASymbol];
    const TokenBSymbol = 'WMATIC';
    const tokenB = Tokens[Network.POLYGON][TokenBSymbol];

    it('getPoolIdentifiers and getPricesVolume', async function () {
      const dexHelper = new DummyDexHelper(Network.POLYGON);
      const blocknumber = await dexHelper.provider.getBlockNumber();
      const dystopia = new Dystopia(Network.POLYGON, dexKey, dexHelper);
      const pools = await dystopia.getPoolIdentifiers(
        tokenA,
        tokenB,
        SwapSide.SELL,
        blocknumber,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await dystopia.getPricesVolume(
        tokenA,
        tokenB,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log(
        '${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ',
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    });

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(Network.POLYGON);
      const dystopia = new Dystopia(Network.POLYGON, dexKey, dexHelper);

      const poolLiquidity = await dystopia.getTopPoolsForToken(
        tokenA.address,
        10,
      );
      console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
    });
  });
  describe('Curve like stable pool', function () {
    const dexKey = 'DystopiaStable';
    const TokenASymbol = 'USDC';
    const tokenA = Tokens[Network.POLYGON][TokenASymbol];
    const TokenBSymbol = 'USDT';
    const tokenB = Tokens[Network.POLYGON][TokenBSymbol];

    it('getPoolIdentifiers and getPricesVolume', async function () {
      const dexHelper = new DummyDexHelper(Network.POLYGON);
      const blocknumber = await dexHelper.provider.getBlockNumber();
      const dystopiaStable = new DystopiaStable(
        Network.POLYGON,
        dexKey,
        dexHelper,
      );
      const pools = await dystopiaStable.getPoolIdentifiers(
        tokenA,
        tokenB,
        SwapSide.SELL,
        blocknumber,
      );
      console.log(
        `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
        pools,
      );

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await dystopiaStable.getPricesVolume(
        tokenA,
        tokenB,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log(
        '${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ',
        poolPrices,
      );

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    });

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(Network.POLYGON);
      const dystopiaStable = new DystopiaStable(
        Network.POLYGON,
        dexKey,
        dexHelper,
      );

      const poolLiquidity = await dystopiaStable.getTopPoolsForToken(
        tokenA.address,
        10,
      );
      console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
    });
  });
});
