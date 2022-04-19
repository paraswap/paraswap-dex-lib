import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { MakerPsm } from './maker-psm';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_0, BI_POW_18, BI_POW_8 } from '../../bigint-constants';

const network = Network.MAINNET;
const TokenASymbol = 'USDC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'DAI';
const TokenB = Tokens[network][TokenBSymbol];

const tokenAAmounts = [BI_0, BI_POW_8, BigInt('200000000')];

const tokenBAmounts = [BI_0, BI_POW_18, BigInt('2000000000000000000')];

const dexKey = 'MakerPsm';

describe('MakerPsm', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const makerPsm = new MakerPsm(network, dexKey, dexHelper);

    await makerPsm.initializePricing(blocknumber);

    const pools = await makerPsm.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await makerPsm.getPricesVolume(
      TokenA,
      TokenB,
      tokenAAmounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, tokenAAmounts, SwapSide.SELL, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const makerPsm = new MakerPsm(network, dexKey, dexHelper);

    await makerPsm.initializePricing(blocknumber);

    const pools = await makerPsm.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await makerPsm.getPricesVolume(
      TokenA,
      TokenB,
      tokenBAmounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, tokenBAmounts, SwapSide.BUY, dexKey);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const makerPsm = new MakerPsm(network, dexKey, dexHelper);

    const poolLiquidity = await makerPsm.getTopPoolsForToken(
      TokenA.address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
  });
});
