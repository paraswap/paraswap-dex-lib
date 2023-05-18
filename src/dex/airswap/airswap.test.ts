import { SwapSide } from '@paraswap/core';
import { priceFromThreshold, mapMakerSELLResponse } from './airswap-tools';
import { BN_1 } from '../../bignumber-constants';
import { Tokens } from '../../../tests/constants-e2e';
import { Network } from '../../constants';
import { PriceLevel } from './types';
import BigNumber from 'bignumber.js';

describe('airswap', () => {
  it('unit price', () => {
    const amounts = [BN_1];
    const levels = mapMakerSELLResponse([[1, 1]]);
    const srcToken = Tokens[Network.MAINNET].USDC;
    const destToken = Tokens[Network.MAINNET].USDT;
    const prices = priceFromThreshold(
      amounts,
      levels,
      srcToken,
      destToken,
      SwapSide.SELL,
    );
    expect(prices).toEqual({ prices: [1n], unitPrice: 1n });
  });

  it('amount prices', () => {
    const amounts = [0n, 1n, 2000n, 4000n, 6000n, 8000n, 20000n].map(
      amount => new BigNumber(amount.toString()),
    );
    const levels = mapMakerSELLResponse([
      [1, 1],
      [1000, 2],
      [10000, 3],
    ]);
    const srcToken = Tokens[Network.MAINNET].USDC;
    const destToken = Tokens[Network.MAINNET].USDT;
    const prices = priceFromThreshold(
      amounts,
      levels,
      srcToken,
      destToken,
      SwapSide.SELL,
    );
    expect(prices).toEqual({
      prices: [0n, 1n, 3999n, 7999n, 11999n, 15999n, 58998n],
      unitPrice: 1n,
    });
  });

  it('amount prices weth usdt', () => {
    const amounts = [0n, 0n, 0n, 0n, 0n, 1n, 1n, 1n, 1n, 1n, 2n].map(
      amount => new BigNumber(amount.toString()),
    );
    const levels = mapMakerSELLResponse([
      [0.0005572908974891259, 1798.6982718579923],
      [0.9426731241803402, 1798.698296804386],
      [1.9796135607787146, 1798.6983491770632],
      [3.1202480410369264, 1798.698406803232],
      [4.37494596932096, 1798.6984701920182],
      [5.755113690433396, 1798.6985399196803],
      [7.273298183657077, 1798.698616620111],
    ]);
    const srcToken = Tokens[Network.POLYGON].WETH;
    const destToken = Tokens[Network.POLYGON].USDT;
    const prices = priceFromThreshold(
      amounts,
      levels,
      srcToken,
      destToken,
      SwapSide.SELL,
    );
    expect(prices).toEqual({
      prices: [0n, 0n, 0n, 0n, 0n, 1799n, 1799n, 1799n, 1799n, 1799n, 3597n],
      unitPrice: 1799n,
    });
  });
});
