import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { DystopiaStable } from './dystopia-stable';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';
import { Tokens } from '../../../tests/constants-e2e';

const amounts = [0n, BI_POWS[6], 2000000n];

const dexKey = 'DystopiaStable';

const TokenASymbol = 'USDC';
const tokenA = Tokens[Network.POLYGON][TokenASymbol];
const TokenBSymbol = 'USDT';
const tokenB = Tokens[Network.POLYGON][TokenBSymbol];

describe('DystopiaStable', function () {
  it('getPoolIdentifiers and getPricesVolume', async function () {
    const dexHelper = new DummyDexHelper(Network.POLYGON);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const uniswapV2 = new DystopiaStable(Network.POLYGON, dexKey, dexHelper);

    const pools = await uniswapV2.getPoolIdentifiers(
      tokenA,
      tokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await uniswapV2.getPricesVolume(
      tokenA,
      tokenB,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log('${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(Network.POLYGON);
    const uniswapV2 = new DystopiaStable(Network.POLYGON, dexKey, dexHelper);

    const poolLiquidity = await uniswapV2.getTopPoolsForToken(
      tokenA.address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
  });
});
