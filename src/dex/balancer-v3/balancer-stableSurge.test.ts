// npx jest src/dex/balancer-v3/balancer-stableSurge.test.ts
import dotenv from 'dotenv';
dotenv.config();
import { Tokens } from '../../../tests/constants-e2e';
import { Network, SwapSide } from '../../constants';
import { DummyDexHelper } from '../../dex-helper';
import { BalancerV3 } from './balancer-v3';
import { checkOnChainPricingNonMulti } from './balancer-test-helpers';
import { ExchangePrices, Token } from '../../types';
import { BalancerV3Data } from './types';

const dexKey = 'BalancerV3';
const blockNumber = 7651340;
let balancerV3: BalancerV3;
const network = Network.SEPOLIA;
const dexHelper = new DummyDexHelper(network);
const tokens = Tokens[network];
const bal = tokens['bal'];
const weth = tokens['WETH'];
// https://sepolia.etherscan.io/address/0x132F4bAa39330d9062fC52d81dF72F601DF8C01f
const stableSurgePool =
  '0x132F4bAa39330d9062fC52d81dF72F601DF8C01f'.toLowerCase();

describe('BalancerV3 stableSurge hook tests', function () {
  beforeAll(async () => {
    balancerV3 = new BalancerV3(network, dexKey, dexHelper);
    if (balancerV3.initializePricing) {
      await balancerV3.initializePricing(blockNumber);
    }
  });

  describe('pool with stableSurge hook should be returned', function () {
    it('getPoolIdentifiers', async function () {
      const pools = await balancerV3.getPoolIdentifiers(
        bal,
        weth,
        SwapSide.SELL,
        blockNumber,
      );
      expect(pools.some(pool => pool === stableSurgePool)).toBe(true);
    });

    it('getTopPoolsForToken', async function () {
      const pools = await balancerV3.getTopPoolsForToken(weth.address, 10);
      expect(pools.some(pool => pool.address === stableSurgePool)).toBe(true);
    });
  });

  describe('should match onchain pricing', function () {
    describe('using staticFee', function () {
      it('SELL', async function () {
        const amounts = [0n, 10000000000000000n];
        const side = SwapSide.SELL;
        await testPricesVsOnchain(amounts, weth, bal, side, blockNumber, [
          stableSurgePool,
        ]);
      });
      it('BUY', async function () {
        const amounts = [0n, 500000000000000000n];
        const side = SwapSide.BUY;
        await testPricesVsOnchain(amounts, weth, bal, side, blockNumber, [
          stableSurgePool,
        ]);
      });
    });
    describe('using surge fee', function () {
      it('SELL', async function () {
        const amounts = [0n, 8000000000000000000n];
        const side = SwapSide.SELL;
        await testPricesVsOnchain(amounts, bal, weth, side, blockNumber, [
          stableSurgePool,
        ]);
      });
      it('BUY', async function () {
        const amounts = [0n, 4000000000000000n];
        const side = SwapSide.BUY;
        await testPricesVsOnchain(amounts, bal, weth, side, blockNumber, [
          stableSurgePool,
        ]);
      });
    });
  });
});

async function testPricesVsOnchain(
  amounts: bigint[],
  srcToken: Token,
  dstToken: Token,
  side: SwapSide,
  blockNumber: number,
  limitPools: string[],
) {
  const prices = await balancerV3.getPricesVolume(
    srcToken,
    dstToken,
    amounts,
    side,
    blockNumber,
    limitPools,
  );
  expect(prices).not.toBeNull();
  await checkOnChainPricingNonMulti(
    network,
    side,
    balancerV3,
    blockNumber,
    prices as ExchangePrices<BalancerV3Data>,
    amounts,
  );
}
