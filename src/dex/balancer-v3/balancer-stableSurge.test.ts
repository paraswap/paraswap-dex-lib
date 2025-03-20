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
const blockNumber = 22086000;
let balancerV3: BalancerV3;
const network = Network.MAINNET;
const dexHelper = new DummyDexHelper(network);
const tokens = Tokens[network];
const usdc = tokens['USDC'];
const weth = tokens['WETH'];
// https://etherscan.io/address/0x6b49054c350b47ca9aa1331ab156a1eedbe94e79
const stableSurgePool =
  '0x6b49054c350b47ca9aa1331ab156a1eedbe94e79'.toLowerCase();

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
        usdc,
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
        const amounts = [0n, 100000000n];
        const side = SwapSide.SELL;
        await testPricesVsOnchain(amounts, usdc, weth, side, blockNumber, [
          stableSurgePool,
        ]);
      });
      it('BUY', async function () {
        const amounts = [0n, 500000n];
        const side = SwapSide.BUY;
        await testPricesVsOnchain(amounts, weth, usdc, side, blockNumber, [
          stableSurgePool,
        ]);
      });
    });
    describe('using surge fee', function () {
      it('SELL', async function () {
        const amounts = [0n, 1000000000000000000n];
        const side = SwapSide.SELL;
        await testPricesVsOnchain(amounts, weth, usdc, side, blockNumber, [
          stableSurgePool,
        ]);
      });
      it('BUY', async function () {
        const amounts = [0n, 1976459205n];
        const side = SwapSide.BUY;
        await testPricesVsOnchain(amounts, weth, usdc, side, blockNumber, [
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
  expect(prices?.length).toBeGreaterThan(0);
  expect(allPricesAreZero(prices!)).toBe(false);
  await checkOnChainPricingNonMulti(
    network,
    side,
    balancerV3,
    blockNumber,
    prices as ExchangePrices<BalancerV3Data>,
    amounts,
  );
}

function allPricesAreZero(arr: { prices: bigint[] }[]): boolean {
  // Check if the array is empty first
  if (arr.length === 0) return false;

  // Iterate through each object in the array
  for (const obj of arr) {
    // Check if this object has any non-zero price
    const hasNonZeroPrice = obj.prices.some(price => price !== 0n);

    // If we found even one non-zero price, return false
    if (hasNonZeroPrice) {
      return false;
    }
  }

  // If we got here, all prices in all objects are 0n
  return true;
}
