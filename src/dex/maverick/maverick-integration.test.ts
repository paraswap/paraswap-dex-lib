import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { Maverick } from './maverick';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

const network = Network.POLYGON;
const TokenASymbol = 'WETH';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'USDC';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [0n, 500000000000000000n, BI_POWS[18]];

const dexKey = 'Maverick';

describe('Maverick', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const maverick = new Maverick(network, dexKey, dexHelper);
    await maverick.initializePricing(blocknumber);

    const pools = await maverick.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await maverick.getPricesVolume(
      TokenA,
      TokenB,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    if (maverick.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    }
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const maverick = new Maverick(network, dexKey, dexHelper);
    const poolLiquidity = await maverick.getTopPoolsForToken(
      TokenA.address,
      10,
    );

    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    if (!maverick.hasConstantPriceLargeAmounts) {
      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    }
  });
});
