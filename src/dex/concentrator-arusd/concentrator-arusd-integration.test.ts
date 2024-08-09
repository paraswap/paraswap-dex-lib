import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';
import { ConcentratorArusd } from './concentrator-arusd';

const network = Network.MAINNET;

const rUSDSymbol = 'rUSD';
const rUSDToken = Tokens[network][rUSDSymbol];

const arUSDSymbol = 'arUSD';
const arUSDTokne = Tokens[network][arUSDSymbol];

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'ConcentratorArusd';
const dexHelper = new DummyDexHelper(network);
let blocknumber: number;
let concentratorArusd: ConcentratorArusd;

describe('ConcentratorArusd', function () {
  beforeAll(async () => {
    blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    concentratorArusd = new ConcentratorArusd(network, dexKey, dexHelper);
    if (concentratorArusd.initializePricing) {
      await concentratorArusd.initializePricing(blocknumber);
    }
  });

  it('getPoolIdentifiers and getPricesVolume arUSD -> rUSD SELL', async function () {
    const pools = await concentratorArusd.getPoolIdentifiers(
      arUSDTokne,
      rUSDToken,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${arUSDTokne} <> ${rUSDSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await concentratorArusd.getPricesVolume(
      arUSDTokne,
      rUSDToken,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${arUSDSymbol} <> ${rUSDSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume rUSD -> arUSD SELL', async function () {
    const pools = await concentratorArusd.getPoolIdentifiers(
      rUSDToken,
      arUSDTokne,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${rUSDSymbol} <> ${arUSDSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await concentratorArusd.getPricesVolume(
      rUSDToken,
      arUSDTokne,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${rUSDSymbol} <> ${arUSDSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('arUSD getTopPoolsForToken', async function () {
    const poolLiquidity = await concentratorArusd.getTopPoolsForToken(
      arUSDTokne.address,
      10,
    );
    console.log(`${arUSDSymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, arUSDTokne.address, dexKey);
  });

  it('rUSD getTopPoolsForToken', async function () {
    const poolLiquidity = await concentratorArusd.getTopPoolsForToken(
      rUSDToken.address,
      10,
    );
    console.log(`${rUSDSymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, rUSDToken.address, dexKey);
  });
});
