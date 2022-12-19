import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BalancerV2 } from './balancer-v2';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';

const WETH = {
  address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  decimals: 18,
};
const DAI = {
  address: '0x6b175474e89094c44da98b954eedeac495271d0f',
  decimals: 18,
};

const USDC = {
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  decimals: 6,
};

const BBADAI = {
  address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
  decimals: 18,
};

const BBAUSD = {
  address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
  decimals: 18,
};

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'BalancerV2';

jest.setTimeout(50 * 1000);

describe('BalancerV2', function () {
  describe('Weighted', () => {
    it('getPoolIdentifiers and getPricesVolume', async function () {
      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const blocknumber = await dexHelper.provider.getBlockNumber();
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      await balancerV2.initializePricing(blocknumber);

      const pools = await balancerV2.getPoolIdentifiers(
        WETH,
        DAI,
        SwapSide.SELL,
        blocknumber,
      );
      console.log('WETH <> DAI Pool Identifiers: ', pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await balancerV2.getPricesVolume(
        WETH,
        DAI,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log('WETH <> DAI Pool Prices: ', poolPrices);
      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
      expect(poolPrices?.[0].gasCost).toBe(150000); // TO DO
    });

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      const poolLiquidity = await balancerV2.getTopPoolsForToken(
        WETH.address,
        10,
      );
      console.log('WETH Top Pools:', poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, WETH.address, dexKey);
    });
  });

  describe('Linear', () => {
    it('getPoolIdentifiers and getPricesVolume', async function () {
      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const blocknumber = await dexHelper.provider.getBlockNumber();
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      await balancerV2.initializePricing(blocknumber);

      const pools = await balancerV2.getPoolIdentifiers(
        DAI,
        BBADAI,
        SwapSide.SELL,
        blocknumber,
      );
      console.log('DAI <> BBADAI Pool Identifiers: ', pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await balancerV2.getPricesVolume(
        DAI,
        BBADAI,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log('DAI <> BBADAI Pool Prices: ', poolPrices);

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
      expect(poolPrices?.[0].gasCost).toBe(100000); // TO DO
    });

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      const poolLiquidity = await balancerV2.getTopPoolsForToken(
        BBADAI.address,
        10,
      );
      console.log('BBADAI Top Pools:', poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, BBADAI.address, dexKey);
    });
  });

  describe('PhantomStable', () => {
    /*
    As advised by @shresth this test has been commented out.
    checkPoolPrices expects price to decrease as higher amounts are used. Linear/PhantomStable can sometimes return same or better.
    Example (confirmed on EVM):
      PhantomStable Pool: DAI>BBADAI
      prices: [ 0n, 1002063220340675582n, 2004126440858960874n ] (1002063220340675582, 1002063220518285292)
    */
    // it('getPoolIdentifiers and getPricesVolume', async function () {
    //   const dexHelper = new DummyDexHelper(Network.MAINNET);
    //   const blocknumber = await dexHelper.provider.getBlockNumber();
    //   const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);
    //   await balancerV2.initializePricing(blocknumber);
    //   const pools = await balancerV2.getPoolIdentifiers(
    //     BBAUSD,
    //     BBADAI,
    //     SwapSide.SELL,
    //     blocknumber,
    //   );
    //   console.log('BBAUSD <> BBADAI Pool Identifiers: ', pools);
    //   expect(pools.length).toBeGreaterThan(0);
    //   const poolPrices = await balancerV2.getPricesVolume(
    //     BBAUSD,
    //     BBADAI,
    //     amounts,
    //     SwapSide.SELL,
    //     blocknumber,
    //     pools,
    //   );
    //   console.log('BBAUSD <> BBADAI Pool Prices: ', poolPrices);
    //   expect(poolPrices).not.toBeNull();
    //   checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
    // });
    // it('getTopPoolsForToken', async function () {
    //   const dexHelper = new DummyDexHelper(Network.MAINNET);
    //   const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);
    //   const poolLiquidity = await balancerV2.getTopPoolsForToken(
    //     BBAUSD.address,
    //     10,
    //   );
    //   console.log('BBAUSD Top Pools:', poolLiquidity);
    //   checkPoolsLiquidity(poolLiquidity, BBAUSD.address, dexKey);
    // });
  });

  describe('VirtualBoosted Pools', () => {
    it('getPoolIdentifiers and getPricesVolume', async function () {
      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const blocknumber = await dexHelper.provider.getBlockNumber();
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      await balancerV2.initializePricing(blocknumber);

      const pools = await balancerV2.getPoolIdentifiers(
        DAI,
        USDC,
        SwapSide.SELL,
        blocknumber,
      );
      console.log('DAI <> USDC Pool Ideintifiers: ', pools);

      expect(pools.length).toBeGreaterThan(0);
      // VirtualBoosted pool should return identifiers for all the internal pools
      // for bbausd this is 3 Linear pools and the PhantomStable linking them
      expect(pools).toContain(
        'BalancerV2_0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2virtualboosted',
      );
      expect(pools).toContain(
        'BalancerV2_0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2', // PhantomStable
      );
      expect(pools).toContain(
        'BalancerV2_0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c', // bUSDT (Linear)
      );
      expect(pools).toContain(
        'BalancerV2_0x804cdb9116a10bb78768d3252355a1b18067bf8f', // bDAI (Linear)
      );
      expect(pools).toContain(
        'BalancerV2_0x9210f1204b5a24742eba12f710636d76240df3d0', // bUSDC (Linear)
      );

      const poolPrices = await balancerV2.getPricesVolume(
        DAI,
        USDC,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log('DAI <> USDC Pool Prices: ', poolPrices);

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);
      const virtualPoolIdentifier = poolPrices?.find(
        p =>
          p.poolIdentifier!.toLowerCase() ===
          'BalancerV2_0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fevirtualboosted'.toLowerCase(),
      );
      expect(virtualPoolIdentifier).not.toBeUndefined();
      expect(virtualPoolIdentifier?.poolAddresses).toEqual([
        '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
        '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
        '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
        '0x9210f1204b5a24742eba12f710636d76240df3d0',
      ]);
      expect(virtualPoolIdentifier?.data.poolId).toEqual(
        '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fevirtualboosted',
      );
      expect(virtualPoolIdentifier?.gasCost).toBe(100000 * 2 + 130000); // TO DO 2 * Linear + 1 * Phantom
    });

    it('getTopPoolsForToken', async function () {
      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      const poolLiquidity = await balancerV2.getTopPoolsForToken(
        DAI.address,
        10,
      );
      console.log('DAI Top Pools:', poolLiquidity);

      const virtualPool = poolLiquidity?.find(
        p => p.address === '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
      );
      expect(virtualPool).not.toBeUndefined();

      checkPoolsLiquidity(poolLiquidity, DAI.address, dexKey);
    });
  });
});
