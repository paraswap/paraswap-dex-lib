import { SwapSide } from '@paraswap/core';
import { computePricesFromLevels } from './airswap-tools';
import { BN_1 } from '../../bignumber-constants';
import { Tokens } from '../../../tests/constants-e2e';
import { Network } from '../../constants';
import { PriceLevel } from './types';
import BigNumber from 'bignumber.js';

describe('airswap', () => {
  it('unit price', () => {
    const amounts = [BN_1];
    const levels = [{ level: '1', price: '1' }];
    const srcToken = Tokens[Network.MAINNET].USDC;
    const destToken = Tokens[Network.MAINNET].USDT;
    const prices = computePricesFromLevels(
      amounts,
      levels,
      srcToken,
      destToken,
      SwapSide.SELL,
    );
    expect(prices).toEqual([1000000n]);
  });

  it('amount prices', () => {
    const amounts = [
      0n,
      2000n,
      4000n,
      6000n,
      8000n,
      10000n,
      12000n,
      14000n,
      16000n,
      18000n,
      20000n,
    ].map(amount => new BigNumber(amount.toString()).dividedBy(18));
    const levels = [
      { level: '10', price: '0.99' },
      { level: '1000', price: '0.98' },
      { level: '1000', price: '0.97' },
      { level: '10000', price: '0.96' },
    ];
    const srcToken = Tokens[Network.MAINNET].USDC;
    const destToken = Tokens[Network.MAINNET].USDT;
    const prices = computePricesFromLevels(
      amounts,
      levels,
      srcToken,
      destToken,
      SwapSide.SELL,
    );
    expect(prices).toEqual([
      0n,
      108988889n,
      217877778n,
      326766667n,
      435655556n,
      544544444n,
      653433333n,
      762322222n,
      871211111n,
      980100000n,
      1086766667n,
    ]);
  });
});
