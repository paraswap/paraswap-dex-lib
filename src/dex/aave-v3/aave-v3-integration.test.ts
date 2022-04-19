import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { AaveV3 } from './aave-v3';
import {
  checkConstantPoolPrices,
  checkPoolsLiquidity,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import { getTokenFromASymbol } from './tokens';
import { BI_0, BI_POW_6 } from '../../bigint-constants';

/*
  README
  ======

  This test script adds tests for AaveV3 general integration
  with the DEX interface. The test cases below are example tests.
  It is recommended to add tests which cover AaveV3 specific
  logic.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-integration.test.ts`

  (This comment should be removed from the final implementation)
*/

const network = Network.POLYGON;
const TokenASymbol = 'USDT';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'aUSDT';
const TokenB = getTokenFromASymbol(network, TokenBSymbol);

const amounts = [BI_0, BI_POW_6, BigInt('2000000')];

const dexKey = 'AaveV3';

describe('AaveV3', function () {
  if (TokenA) {
    if (TokenB) {
      it('getPoolIdentifiers and getPricesVolume SELL', async function () {
        const dexHelper = new DummyDexHelper(network);
        const blocknumber = await dexHelper.provider.getBlockNumber();
        const aaveV3 = new AaveV3(network, dexKey, dexHelper);

        const pools = await aaveV3.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.SELL,
          blocknumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await aaveV3.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.SELL,
          blocknumber,
          pools,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Prices: `,
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();
        checkConstantPoolPrices(poolPrices!, amounts, dexKey);
      });

      it('getPoolIdentifiers and getPricesVolume BUY', async function () {
        const dexHelper = new DummyDexHelper(network);
        const blocknumber = await dexHelper.provider.getBlockNumber();
        const aaveV3 = new AaveV3(network, dexKey, dexHelper);

        const pools = await aaveV3.getPoolIdentifiers(
          TokenA,
          TokenB,
          SwapSide.BUY,
          blocknumber,
        );
        console.log(
          `${TokenASymbol} <> ${TokenBSymbol} Pool Identifiers: `,
          pools,
        );

        expect(pools.length).toBeGreaterThan(0);

        const poolPrices = await aaveV3.getPricesVolume(
          TokenA,
          TokenB,
          amounts,
          SwapSide.BUY,
          blocknumber,
          pools,
        );
        console.log(
          '${TokenASymbol} <> ${TokenBSymbol} Pool Prices: ',
          poolPrices,
        );

        expect(poolPrices).not.toBeNull();
        checkConstantPoolPrices(poolPrices!, amounts, dexKey);
      });
    } else expect(TokenB).not.toBeNull();

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(network);
      const aaveV3 = new AaveV3(network, dexKey, dexHelper);

      const poolLiquidity = await aaveV3.getTopPoolsForToken(
        TokenA.address,
        10,
      );
      console.log(`${TokenASymbol} Top Pools:`, poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, TokenA.address, dexKey);
    });
  } else expect(TokenA).not.toBe(undefined);
});
