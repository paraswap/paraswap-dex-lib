// npx jest src/dex/balancer-v3/balancer-stableSurge.test.ts
import dotenv from 'dotenv';
dotenv.config();
import { Tokens } from '../../../tests/constants-e2e';
import { Network, SwapSide } from '../../constants';
import { DummyDexHelper } from '../../dex-helper';
import { BalancerV3 } from './balancer-v3';
import { testPricesVsOnchain } from './balancer-test-helpers';

const dexKey = 'BalancerV3';
const network = Network.MAINNET;
const dexHelper = new DummyDexHelper(network);
const tokens = Tokens[network];

describe('BalancerV3 stableSurge V1 hook tests', function () {
  const blockNumber = 22086000;
  let balancerV3: BalancerV3;
  const usdc = tokens['USDC'];
  const weth = tokens['WETH'];
  // https://etherscan.io/address/0x6b49054c350b47ca9aa1331ab156a1eedbe94e79
  const stableSurgeV1Pool =
    '0x6b49054c350b47ca9aa1331ab156a1eedbe94e79'.toLowerCase();

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
      expect(pools.some(pool => pool === stableSurgeV1Pool)).toBe(true);
    });

    it('getTopPoolsForToken', async function () {
      const pools = await balancerV3.getTopPoolsForToken(weth.address, 100);
      expect(pools.some(pool => pool.address === stableSurgeV1Pool)).toBe(true);
    });
  });

  describe('should match onchain pricing', function () {
    describe('using staticFee', function () {
      it('SELL', async function () {
        const amounts = [0n, 100000000n];
        const side = SwapSide.SELL;
        // await testPricesVsOnchain(amounts, usdc, weth, side, blockNumber, [
        //   stableSurgePool,
        // ]);
        await testPricesVsOnchain(
          balancerV3,
          network,
          amounts,
          usdc,
          weth,
          side,
          blockNumber,
          [stableSurgeV1Pool],
        );
      });
      it('BUY', async function () {
        const amounts = [0n, 500000n];
        const side = SwapSide.BUY;
        await testPricesVsOnchain(
          balancerV3,
          network,
          amounts,
          weth,
          usdc,
          side,
          blockNumber,
          [stableSurgeV1Pool],
        );
      });
    });
    describe('using surge fee', function () {
      it('SELL', async function () {
        const amounts = [0n, 1000000000000000000n];
        const side = SwapSide.SELL;
        await testPricesVsOnchain(
          balancerV3,
          network,
          amounts,
          weth,
          usdc,
          side,
          blockNumber,
          [stableSurgeV1Pool],
        );
      });
      it('BUY', async function () {
        const amounts = [0n, 1976459205n];
        const side = SwapSide.BUY;
        await testPricesVsOnchain(
          balancerV3,
          network,
          amounts,
          weth,
          usdc,
          side,
          blockNumber,
          [stableSurgeV1Pool],
        );
      });
    });
  });
});

describe('BalancerV3 stableSurge V2 hook tests', function () {
  const blockNumber = 22466700;
  let balancerV3: BalancerV3;
  const EURC = tokens['EUROC'];
  const RLUSD = tokens['RLUSD'];
  // https://etherscan.io/address/0x0629e9703f0447402158eedca5148fe98df6d7a3
  const stableSurgeV2Pool =
    '0x0629e9703f0447402158eedca5148fe98df6d7a3'.toLowerCase();

  beforeAll(async () => {
    balancerV3 = new BalancerV3(network, dexKey, dexHelper);
    if (balancerV3.initializePricing) {
      await balancerV3.initializePricing(blockNumber);
    }
  });

  describe('pool with stableSurge hook should be returned', function () {
    it('getPoolIdentifiers', async function () {
      const pools = await balancerV3.getPoolIdentifiers(
        EURC,
        RLUSD,
        SwapSide.SELL,
        blockNumber,
      );
      expect(pools.some(pool => pool === stableSurgeV2Pool)).toBe(true);
    });

    it('getTopPoolsForToken', async function () {
      const pools = await balancerV3.getTopPoolsForToken(RLUSD.address, 100);
      expect(pools.some(pool => pool.address === stableSurgeV2Pool)).toBe(true);
    });
  });

  describe('should match onchain pricing', function () {
    it('SELL', async function () {
      const amounts = [0n, 100000000n];
      const side = SwapSide.SELL;
      await testPricesVsOnchain(
        balancerV3,
        network,
        amounts,
        EURC,
        RLUSD,
        side,
        blockNumber,
        [stableSurgeV2Pool],
      );
    });
    it('BUY', async function () {
      const amounts = [0n, 700000000n];
      const side = SwapSide.BUY;
      await testPricesVsOnchain(
        balancerV3,
        network,
        amounts,
        RLUSD,
        EURC,
        side,
        blockNumber,
        [stableSurgeV2Pool],
      );
    });
  });
});
