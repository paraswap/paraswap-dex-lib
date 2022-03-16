import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { Balancer } from './balancer-v1';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

const network = Network.MAINNET;
const TokenASymbol = 'TokenASymbol';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'TokenBSymbol';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  BigInt('0'),
  BigInt('1000000000000000000'),
  BigInt('2000000000000000000'),
];

const dexKey = 'Balancer';

describe('Balancer', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const balancer = new Balancer(network, dexKey, dexHelper);

    await balancer.setupEventPools(blocknumber);

    const pools = await balancer.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(
      `${TokenASymbol} <> ${TokenBSymbol} Pool Ideintifiers: `,
      pools,
    );

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await balancer.getPricesVolume(
      WETH,
      DAI,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log('${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const balancer = new Balancer(network, dexKey, dexHelper);

    await balancer.setupEventPools(blocknumber);

    const pools = await balancer.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(
      `${TokenASymbol} <> ${TokenBSymbol} Pool Ideintifiers: `,
      pools,
    );

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await balancer.getPricesVolume(
      WETH,
      DAI,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log('${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey);
  });

  it('getTopPoolsForToken', async function () {
    const dexHelper = new DummyDexHelper(network);
    const balancer = new Balancer(network, dexKey, dexHelper);

    const poolLiquidity = await balancer.getTopPoolsForToken(
      TokenA.address,
      10,
    );
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
  });
});
