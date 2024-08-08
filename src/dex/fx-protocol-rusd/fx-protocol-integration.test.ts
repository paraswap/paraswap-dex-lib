import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';
import { FxProtocolRusd } from './fx-protocol-rusd';

const network = Network.MAINNET;

const rUSDSymbol = 'rUSD';
const rUSDToken = Tokens[network][rUSDSymbol];

const weETHSymbol = 'weETH';
const weETHToken = Tokens[network][weETHSymbol];

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'FxProtocolRusd';
const dexHelper = new DummyDexHelper(network);
let blocknumber: number;
let fxProtocolRusd: FxProtocolRusd;

describe('FxProtocolRusd', function () {
  beforeAll(async () => {
    blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
    fxProtocolRusd = new FxProtocolRusd(network, dexKey, dexHelper);
    if (fxProtocolRusd.initializePricing) {
      await fxProtocolRusd.initializePricing(blocknumber);
    }
  });

  it('getPoolIdentifiers and getPricesVolume weETH -> rUSD SELL', async function () {
    const pools = await fxProtocolRusd.getPoolIdentifiers(
      weETHToken,
      rUSDToken,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${weETHSymbol} <> ${rUSDSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await fxProtocolRusd.getPricesVolume(
      weETHToken,
      rUSDToken,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${weETHSymbol} <> ${rUSDSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume rUSD -> weETH SELL', async function () {
    const pools = await fxProtocolRusd.getPoolIdentifiers(
      rUSDToken,
      weETHToken,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${rUSDSymbol} <> ${weETHSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await fxProtocolRusd.getPricesVolume(
      rUSDToken,
      weETHToken,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${rUSDSymbol} <> ${weETHSymbol} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('weETH getTopPoolsForToken', async function () {
    const poolLiquidity = await fxProtocolRusd.getTopPoolsForToken(
      weETHToken.address,
      10,
    );
    console.log(`${weETHSymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, weETHToken.address, dexKey);
  });

  it('rUSD getTopPoolsForToken', async function () {
    const poolLiquidity = await fxProtocolRusd.getTopPoolsForToken(
      rUSDToken.address,
      10,
    );
    console.log(`${rUSDSymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, rUSDToken.address, dexKey);
  });
});
