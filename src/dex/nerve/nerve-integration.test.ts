import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { Nerve } from './nerve';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';

describe('Nerve BSC', function () {
  const dexKey = 'Nerve';
  const network = Network.BSC;
  const TokenASymbol = 'USDC';
  const TokenA = Tokens[network][TokenASymbol];

  const TokenBSymbol = 'BUSD';
  const TokenB = Tokens[network][TokenBSymbol];

  const amounts = [
    BigInt('0'),
    BigInt('111000000'),
    BigInt('222000000'),
    BigInt('333000000'),
    BigInt('444000000'),
    BigInt('555000000'),
    BigInt('666000000'),
    BigInt('777000000'),
    BigInt('888000000'),
    BigInt('999000000'),
    BigInt('1111000000'),
  ];

  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const nerve = new Nerve(network, dexKey, dexHelper);

    await nerve.initializePricing(blocknumber);

    const pools = await nerve.getPoolIdentifiers(
      TokenA,
      TokenB,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await nerve.getPricesVolume(
      TokenA,
      TokenB,
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
    const dexHelper = new DummyDexHelper(network);
    const nerve = new Nerve(network, dexKey, dexHelper);

    const poolLiquidity = await nerve.getTopPoolsForToken(TokenA.address, 10);
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
  });
});
