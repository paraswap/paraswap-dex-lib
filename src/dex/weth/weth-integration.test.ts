import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { Weth } from './weth';
import { checkConstantPoolPrices } from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';

const network = Network.MAINNET;
const EthSymbol = 'ETH';
const EthToken = Tokens[network][EthSymbol];

const WethSymbol = 'WETH';
const WethToken = Tokens[network][WethSymbol];

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'Weth';

describe('Weth', function () {
  it('getPoolIdentifiers and getPricesVolume SELL', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const weth = new Weth(network, dexKey, dexHelper);

    const pools = await weth.getPoolIdentifiers(
      EthToken,
      WethToken,
      SwapSide.SELL,
      blocknumber,
    );
    console.log(`${EthToken} <> ${WethToken} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await weth.getPricesVolume(
      EthToken,
      WethToken,
      amounts,
      SwapSide.SELL,
      blocknumber,
      pools,
    );
    console.log(`${EthToken} <> ${WethToken} Pool Prices: `, poolPrices);

    expect(poolPrices).not.toBeNull();
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  });

  it('getPoolIdentifiers and getPricesVolume BUY', async function () {
    const dexHelper = new DummyDexHelper(network);
    const blocknumber = await dexHelper.provider.getBlockNumber();
    const weth = new Weth(network, dexKey, dexHelper);

    const pools = await weth.getPoolIdentifiers(
      EthToken,
      WethToken,
      SwapSide.BUY,
      blocknumber,
    );
    console.log(`${EthToken} <> ${WethToken} Pool Identifiers: `, pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await weth.getPricesVolume(
      EthToken,
      WethToken,
      amounts,
      SwapSide.BUY,
      blocknumber,
      pools,
    );
    console.log('${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkConstantPoolPrices(poolPrices!, amounts, dexKey);
  });
});
