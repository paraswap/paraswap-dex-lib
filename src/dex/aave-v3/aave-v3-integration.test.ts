import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { AaveV3 } from './aave-v3';
import {
  checkConstantPoolPrices,
  checkPoolsLiquidity,
} from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';

const network = Network.POLYGON;
const TokenASymbol = 'USDT';
const TokenA = {
  address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
  decimals: 6,
};

const TokenBSymbol = 'aPolUSDT';
const TokenB = {
  address: '0x6ab707aca953edaefbc4fd23ba73294241490620',
  decimals: 6,
  symbol: 'aPolUSDT',
};

const amounts = [0n, BI_POWS[6], 2000000n];

const dexKey = 'AaveV3';

describe('AaveV3', function () {
  if (TokenA) {
    if (TokenB) {
      it('getPoolIdentifiers and getPricesVolume SELL', async function () {
        const dexHelper = new DummyDexHelper(network);
        const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
        const aaveV3 = new AaveV3(network, dexKey, dexHelper);

        // Invoke the "initializePricing" method manually in tests. Invoked by the SDK automatically otherwise.
        await aaveV3.initializePricing(blocknumber);

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
        const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
        const aaveV3 = new AaveV3(network, dexKey, dexHelper);

        // Invoke the "initializePricing" method manually in tests. Invoked by the SDK automatically otherwise.
        await aaveV3.initializePricing(blocknumber);

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
