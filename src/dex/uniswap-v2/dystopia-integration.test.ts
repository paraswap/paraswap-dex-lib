import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { Network, SwapSide } from '../../constants';
import { Dystopia } from './dystopia';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';
import { Tokens } from '../../../tests/constants-e2e';

const amounts = [0n, BI_POWS[18], 2000000000000000000n];
const dexKey = 'Dystopia';
const TokenASymbol = 'WETH';
const tokenA = Tokens[Network.POLYGON][TokenASymbol];
const TokenBSymbol = 'WMATIC';
const tokenB = Tokens[Network.POLYGON][TokenBSymbol];

describe('Dystopia', function () {
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
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await dystopia.getPricesVolume(
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
    const uniswapV2 = new Dystopia(Network.POLYGON, dexKey, dexHelper);

    const poolLiquidity = await uniswapV2.getTopPoolsForToken(
      tokenA.address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, tokenA.address, dexKey);
  });
});
