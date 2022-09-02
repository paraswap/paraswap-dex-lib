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
    0n,
    111000000n,
    222000000n,
    333000000n,
    444000000n,
    555000000n,
    666000000n,
    777000000n,
    888000000n,
    999000000n,
    1111000000n,
  ];

  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    await dexHelper.init();
    const blocknumber = dexHelper.blockManager.getLatestBlockNumber();
    const nerve = new Nerve(dexHelper, dexKey);

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
    const nerve = new Nerve(dexHelper, dexKey);

    const poolLiquidity = await nerve.getTopPoolsForToken(TokenA.address, 10);
    console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

    checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
  });
});
