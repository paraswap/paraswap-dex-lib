import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { SquadswapV2 } from './squadswap-v2';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';

const WBNB = Tokens[Network.BSC]['WBNB'];
const USDT = Tokens[Network.BSC]['USDT'];
const testingData: Partial<{ [key in Network]: any }> = {
  [Network.MAINNET]: {
    tokenA: Tokens[Network.MAINNET]['WBTC'],
    tokenASymbol: 'WBTC',
    stableA: Tokens[Network.MAINNET]['USDC'],
    stableASymbol: 'USDC',
    tokenB: Tokens[Network.MAINNET]['WETH'],
    tokenBSymbol: 'WETH',
    stableB: Tokens[Network.MAINNET]['USDT'],
    stableBSymbol: 'USDT',
    stableSellAmounts: [
      0n,
      10_000n * BI_POWS[6],
      20_000n * BI_POWS[6],
      30_000n * BI_POWS[6],
    ],
    stableBuyAmounts: [0n, 1n * BI_POWS[6], 2n * BI_POWS[6], 3n * BI_POWS[6]],
    regularSellAmounts: [0n, 1n * BI_POWS[8], 2n * BI_POWS[8], 3n * BI_POWS[8]],
    regularBuyAmounts: [
      0n,
      1n * BI_POWS[18],
      2n * BI_POWS[18],
      3n * BI_POWS[18],
    ],
  },
  [Network.BSC]: {
    tokenA: Tokens[Network.BSC]['bBTC'],
    tokenASymbol: 'bBTC',
    stableA: Tokens[Network.BSC]['USDC'],
    stableASymbol: 'USDC',
    tokenB: Tokens[Network.BSC]['WBNB'],
    tokenBSymbol: 'WBNB',
    stableB: Tokens[Network.BSC]['USDT'],
    stableBSymbol: 'USDT',
    stableSellAmounts: [
      0n,
      10_000n * BI_POWS[6],
      20_000n * BI_POWS[6],
      30_000n * BI_POWS[6],
    ],
    stableBuyAmounts: [0n, 1n * BI_POWS[6], 2n * BI_POWS[6], 3n * BI_POWS[6]],
    regularSellAmounts: [
      0n,
      1n * BI_POWS[18],
      2n * BI_POWS[18],
      3n * BI_POWS[18],
    ],
    regularBuyAmounts: [
      0n,
      1n * BI_POWS[18],
      2n * BI_POWS[18],
      3n * BI_POWS[18],
    ],
  },
};
const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'SquadswapV2';

describe('SquadswapV2', function () {
  it('getPoolIdentifiers and getPricesVolume', async function () {
    const dexHelper = new DummyDexHelper(Network.BSC);
    const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const uniswapV2 = new SquadswapV2(Network.BSC, dexKey, dexHelper);

    const pools = await uniswapV2.getPoolIdentifiers(
      WBNB,
      USDT,
      SwapSide.SELL,
      blocknumber,
    );
    console.log('WBNB <> USDT Pool Identifiers: ', pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await uniswapV2.getPricesVolume(
      WBNB,
      USDT,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log('WBNB <> USDT Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(Network.BSC);
    const uniswapV2 = new SquadswapV2(Network.BSC, dexKey, dexHelper);
    const testData = testingData[Network.BSC];
    const {
      stableA,
      stableASymbol,
      stableB,
      stableBSymbol,
      stableSellAmounts,
      stableBuyAmounts,
      tokenA,
      tokenASymbol,
      tokenB,
      tokenBSymbol,
      regularSellAmounts,
      regularBuyAmounts,
    } = testData;

    const poolLiquidity = await uniswapV2.getTopPoolsForToken(
      stableB.address,
      10,
    );
    console.log('WBNB Top Pools:', poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, stableB.address, dexKey);
  });
});
