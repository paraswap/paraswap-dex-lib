import { SwapSide } from '@paraswap/core';
import { computePricesFromLevels, mapMakerSELLResponse } from './airswap-tools';
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
    const levels = mapMakerSELLResponse([
      [1, 1.0000804135489818],
      [28632.23189406919, 1.000031329146842],
      [60127.68697754531, 0.9999282642399678],
      [94772.68756936904, 0.9998149093727866],
      [132882.18822037516, 0.9996902412973147],
      [174802.63893648188, 0.9995531333644397],
      [220915.13472419925, 0.9994023472389632],
    ]);
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
      111114641n,
      222229233n,
      333343825n,
      444458418n,
      555573010n,
      666687602n,
      777802194n,
      888916786n,
      1000031378n,
      1111145970n,
    ]);
  });
  it('amount prices wmatc usdt', () => {
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
    const levels = mapMakerSELLResponse([
      [1.1757098348127681, 0.8537900930509068],
      [1933.421950221556, 0.853812320963361],
      [4060.186095465268, 0.8538066623756011],
      [6399.626655233351, 0.8537927735503444],
      [8973.011270978242, 0.8537800478582299],
      [11803.734348297623, 0.8537660495969018],
      [14917.529733348942, 0.8536935109599769],
    ]);
    const srcToken = Tokens[Network.POLYGON].WMATIC;
    const destToken = Tokens[Network.POLYGON].USDT;
    const prices = computePricesFromLevels(
      amounts,
      levels,
      srcToken,
      destToken,
      SwapSide.SELL,
    );
    expect(prices).toEqual([
      0n,
      94868010n,
      189736045n,
      284604081n,
      379472117n,
      474340152n,
      569208188n,
      664076224n,
      758944259n,
      853812295n,
      948680330n,
    ]);
  });

  it('amount prices weth usdt', () => {
    const amounts = [0n, 0n, 0n, 0n, 0n, 1n, 1n, 1n, 1n, 1n, 2n].map(amount =>
      new BigNumber(amount.toString()).dividedBy(18),
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
    const prices = computePricesFromLevels(
      amounts,
      levels,
      srcToken,
      destToken,
      SwapSide.SELL,
    );
    expect(prices).toEqual([
      0n,
      0n,
      0n,
      0n,
      0n,
      99927683n,
      99927683n,
      99927683n,
      99927683n,
      99927683n,
      199855366n,
    ]);
  });
});
