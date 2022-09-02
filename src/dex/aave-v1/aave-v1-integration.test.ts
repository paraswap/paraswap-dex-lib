import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { AaveV1 } from './aave-v1';
import {
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { aaveV1GetToken } from './tokens';
import { BI_POWS } from '../../bigint-constants';

describe('AaveV1', function () {
  describe('AaveV1 MAINNET', () => {
    const network = Network.MAINNET;
    const USDTSymbol = 'USDT';
    const USDT = Tokens[network][USDTSymbol];

    const aUSDTSymbol = 'aUSDT';
    const aUSDT = aaveV1GetToken(network, aUSDTSymbol);
    if (!aUSDT) {
      expect(aUSDT).not.toBe(null);
      return;
    }

    const amounts = [0n, BI_POWS[18], 2000000000000000000n];

    const dexKey = 'AaveV1';
    it('getPoolIdentifiers and getPricesVolume SELL', async function () {
      const dexHelper = new DummyDexHelper(network);
      await dexHelper.init();

      const blocknumber = dexHelper.blockManager.getLatestBlockNumber();
      const aaveV1 = new AaveV1(dexHelper, dexKey);

      const pools = await aaveV1.getPoolIdentifiers(
        USDT,
        aUSDT,
        SwapSide.SELL,
        blocknumber,
      );
      console.log(`${USDTSymbol} <> ${aUSDTSymbol} Pool Identifiers: `, pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await aaveV1.getPricesVolume(
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
      await dexHelper.init();

      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const aaveV1 = new AaveV1(dexHelper, dexKey);

      const pools = await aaveV1.getPoolIdentifiers(
        USDT,
        aUSDT,
        SwapSide.BUY,
        blocknumber,
      );
      console.log(`${USDTSymbol} <> ${aUSDTSymbol} Pool Identifiers: `, pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await aaveV1.getPricesVolume(
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
      const aaveV1 = new AaveV1(network, dexKey, dexHelper);

      const poolLiquidity = await aaveV1.getTopPoolsForToken(USDT.address, 10);
      console.log(`${USDTSymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, USDT.address, dexKey);
    });
  });
});
