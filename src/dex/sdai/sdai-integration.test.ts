import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';
import { SDai } from './sdai';

const network = Network.MAINNET;

const SDaiSymbol = 'sDAI';
const SDaiToken = Tokens[network][SDaiSymbol];

const DaiSymbol = 'DAI';
const DaiToken = Tokens[network][DaiSymbol];

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'sdai';
const dexHelper = new DummyDexHelper(network);
let blocknumber: number;
let sdai: SDai;

describe('SDai', function () {
  beforeAll(async () => {
    blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    sdai = new SDai(network, dexKey, dexHelper);
    if (sdai.initializePricing) {
      await sdai.initializePricing(blocknumber);
    }
  });

  it('getPoolIdentifiers and getPricesVolume DAI -> sDAI SELL', async function () {
    const pools = await sdai.getPoolIdentifiers(
      DaiToken,
      SDaiToken,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${DaiSymbol} <> ${SDaiSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await sdai.getPricesVolume(
      DaiToken,
      SDaiToken,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${DaiSymbol} <> ${SDaiSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume sDAI -> DAI SELL', async function () {
    const pools = await sdai.getPoolIdentifiers(
      SDaiToken,
      DaiToken,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${SDaiSymbol} <> ${DaiSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await sdai.getPricesVolume(
      SDaiToken,
      DaiToken,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${SDaiSymbol} <> ${DaiSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume DAI -> sDAI BUY', async function () {
    const pools = await sdai.getPoolIdentifiers(
      DaiToken,
      SDaiToken,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(`${DaiSymbol} <> ${SDaiSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await sdai.getPricesVolume(
      DaiToken,
      SDaiToken,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log(`${DaiSymbol} <> ${SDaiSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume sDAI -> DAI BUY', async function () {
    const pools = await sdai.getPoolIdentifiers(
      SDaiToken,
      DaiToken,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(`${SDaiSymbol} <> ${DaiSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await sdai.getPricesVolume(
      SDaiToken,
      DaiToken,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log(`${SDaiSymbol} <> ${DaiSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey);
  });

  it('Dai getTopPoolsForToken', async function () {
    const poolLiquidity = await sdai.getTopPoolsForToken(DaiToken.address, 10);
    console.log(`${DaiSymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, DaiToken.address, dexKey);
  });

  it('SDai getTopPoolsForToken', async function () {
    const poolLiquidity = await sdai.getTopPoolsForToken(SDaiToken.address, 10);
    console.log(`${SDaiSymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, SDaiToken.address, dexKey);
  });
});
