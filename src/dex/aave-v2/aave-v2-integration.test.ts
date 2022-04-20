import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { AaveV2 } from './aave-v2';
import {
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { aaveV2GetToken } from './tokens';
import { BI_POWS } from '../../bigint-constants';

describe('AaveV2', function () {
  describe('AaveV2 MAINNET', () => {
    const network = Network.MAINNET;
    const USDTSymbol = 'USDT';
    const USDT = Tokens[network][USDTSymbol];

    const aUSDTSymbol = 'aUSDT';
    const aUSDT = aaveV2GetToken(network, aUSDTSymbol);

    const amounts = [0n, BI_POWS[18], 2000000000000000000n];

    const dexKey = 'AaveV2';
    if (!aUSDT) {
      expect(aUSDT).not.toBe(null);
      return;
    }

    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      const dexHelper = new DummyDexHelper(network);
      const blocknumber = await dexHelper.provider.getBlockNumber();
      const aaveV2 = new AaveV2(network, dexKey, dexHelper);

      const pools = await aaveV2.getPoolIdentifiers(
        USDT,
        aUSDT,
        SwapSide.SELL,
        blocknumber,
      );
      console.log(`${USDTSymbol} <> ${aUSDTSymbol} Pool Identifiers: `, pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await aaveV2.getPricesVolume(
        USDT,
        aUSDT,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log('${USDTSymbol} <> ${aUSDTSymbol} Pool Prices: ', poolPrices);

      expect(poolPrices).not.toBeNull();
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    });

    it('getPoolIdentifiers and getPricesVolume BUY', async function () {
      const dexHelper = new DummyDexHelper(network);
      const blocknumber = await dexHelper.provider.getBlockNumber();
      const aaveV2 = new AaveV2(network, dexKey, dexHelper);

      const pools = await aaveV2.getPoolIdentifiers(
        USDT,
        aUSDT,
        SwapSide.BUY,
        blocknumber,
      );
      console.log(`${USDTSymbol} <> ${aUSDTSymbol} Pool Identifiers: `, pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await aaveV2.getPricesVolume(
        USDT,
        aUSDT,
        amounts,
        SwapSide.BUY,
        blocknumber,
        pools,
      );
      console.log('${USDTSymbol} <> ${aUSDTSymbol} Pool Prices: ', poolPrices);

      expect(poolPrices).not.toBeNull();
      checkConstantPoolPrices(poolPrices!, amounts, dexKey);
    });

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(network);
      const aaveV2 = new AaveV2(network, dexKey, dexHelper);

      const poolLiquidity = await aaveV2.getTopPoolsForToken(USDT.address, 10);
      console.log(`${USDTSymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, USDT.address, dexKey);
    });
  });
});
