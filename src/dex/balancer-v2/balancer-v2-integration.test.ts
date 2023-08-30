/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BalancerV2 } from './balancer-v2';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';
import { Tokens } from '../../../tests/constants-e2e';
import { BalancerV2Data } from './types';
import { PoolPrices } from '../../types';

const amounts = [0n, BI_POWS[18], 2000000000000000000n];

const dexKey = 'BalancerV2';

async function getOnChainPricingForWeightedPool(
  balancerV2: BalancerV2,
  blockNumber: number,
  poolPrice: PoolPrices<BalancerV2Data>,
  amounts: bigint[],
  srcTokenAddress: string,
  destTokenAddress: string,
  side: SwapSide,
): Promise<BigInt[]> {
  return Promise.all(
    poolPrice.prices.map(async (price, index) => {
      if (amounts[index] === 0n) {
        return 0n;
      }

      const params = balancerV2.getBalancerParam(
        srcTokenAddress,
        destTokenAddress,
        '0',
        '0',
        {
          swaps: [
            {
              poolId: poolPrice.data.poolId,
              amount: amounts[index].toString(),
            },
          ],
        },
        side,
      );

      const calldata = [
        {
          target: balancerV2.vaultAddress,
          callData: balancerV2.eventPools.vaultInterface.encodeFunctionData(
            'queryBatchSwap',
            params.slice(0, 4),
          ),
        },
      ];

      const results = (
        await balancerV2.dexHelper.multiContract.methods
          .aggregate(calldata)
          .call({}, blockNumber)
      ).returnData;

      const parsed = balancerV2.eventPools.vaultInterface.decodeFunctionResult(
        'queryBatchSwap',
        results[0],
      );
      const resultIndex = side === SwapSide.SELL ? parsed[0].length - 1 : 0;
      return BigInt(parsed[0][resultIndex]._hex.replace('-', ''));
    }),
  );
}

describe('BalancerV2', function () {
  describe('ComposableStable', () => {
    it('USDC -> USDT getPoolIdentifiers and getPricesVolume', async () => {
      const network = Network.MAINNET;
      const srcToken = Tokens[network]['USDC'];
      const destToken = Tokens[network]['USDT'];
      const amounts = [0n, 10000001000000n];

      const dexHelper = new DummyDexHelper(network);
      const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
      // You will need blockTimestamp to check onchain calculation, because
      // it depends on timestamp. If you have different values, they are incomparable
      // const block = await dexHelper.web3Provider.eth.getBlock(blockNumber);

      const balancerV2 = new BalancerV2(network, dexKey, dexHelper);

      await balancerV2.initializePricing(blockNumber);

      const pools = await balancerV2.getPoolIdentifiers(
        srcToken,
        destToken,
        SwapSide.SELL,
        blockNumber,
      );
      console.log('Pool Identifiers: ', pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await balancerV2.getPricesVolume(
        srcToken,
        destToken,
        amounts,
        SwapSide.SELL,
        blockNumber,
        pools,
      );
      console.log('Pool Prices: ', poolPrices);

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

      await balancerV2.releaseResources();
    });

    it('getPoolIdentifiers and getPricesVolume', async () => {
      const MIMATIC = Tokens[Network.POLYGON]['MIMATIC'];
      const USDC = Tokens[Network.POLYGON]['USDC'];
      const dexHelper = new DummyDexHelper(Network.POLYGON);
      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const balancerV2 = new BalancerV2(Network.POLYGON, dexKey, dexHelper);

      await balancerV2.initializePricing(blocknumber);

      const pools = await balancerV2.getPoolIdentifiers(
        MIMATIC,
        USDC,
        SwapSide.SELL,
        blocknumber,
      );
      console.log('Pool Identifiers: ', pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await balancerV2.getPricesVolume(
        MIMATIC,
        USDC,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log('Pool Prices: ', poolPrices);

      expect(poolPrices).not.toBeNull();
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

      await balancerV2.releaseResources();
    });
  });
  describe('Weighted', () => {
    it('SELL getPoolIdentifiers and getPricesVolume BAL -> WETH', async function () {
      const BAL = Tokens[Network.MAINNET]['BAL'];
      const WETH = Tokens[Network.MAINNET]['WETH'];
      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      await balancerV2.initializePricing(blocknumber);

      const pools = await balancerV2.getPoolIdentifiers(
        BAL,
        WETH,
        SwapSide.SELL,
        blocknumber,
      );
      console.log('BAL <> WETH Pool Identifiers: ', pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await balancerV2.getPricesVolume(
        BAL,
        WETH,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log('BAL <> WETH Pool Prices: ', poolPrices);

      expect(poolPrices).not.toBeNull();

      const onChainPrices = await getOnChainPricingForWeightedPool(
        balancerV2,
        blocknumber,
        poolPrices![0],
        amounts,
        BAL.address,
        WETH.address,
        SwapSide.SELL,
      );

      console.log('BAL <> WETH on-chain prices: ', onChainPrices);

      expect(onChainPrices).toEqual(poolPrices![0].prices);

      await balancerV2.releaseResources();
    });

    it('BUY getPoolIdentifiers and getPricesVolume BAL -> WETH', async function () {
      const BAL = Tokens[Network.MAINNET]['BAL'];
      const WETH = Tokens[Network.MAINNET]['WETH'];

      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      await balancerV2.initializePricing(blocknumber);

      const pools = await balancerV2.getPoolIdentifiers(
        BAL,
        WETH,
        SwapSide.BUY,
        blocknumber,
      );
      console.log('BAL <> WETH Pool Identifiers: ', pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await balancerV2.getPricesVolume(
        BAL,
        WETH,
        amounts,
        SwapSide.BUY,
        blocknumber,
        pools,
      );
      console.log('BAL <> WETH Pool Prices: ', poolPrices);

      expect(poolPrices).not.toBeNull();

      const onChainPrices = await getOnChainPricingForWeightedPool(
        balancerV2,
        blocknumber,
        poolPrices![0],
        amounts,
        BAL.address,
        WETH.address,
        SwapSide.BUY,
      );

      console.log('BAL <> WETH on-chain prices: ', onChainPrices);

      expect(onChainPrices).toEqual(poolPrices![0].prices);

      await balancerV2.releaseResources();
    });

    it('BUY getPoolIdentifiers and getPricesVolume for PSP -> WETH', async function () {
      const PSP = Tokens[Network.MAINNET]['PSP'];
      const WETH = Tokens[Network.MAINNET]['WETH'];

      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      await balancerV2.initializePricing(blocknumber);

      const pools = await balancerV2.getPoolIdentifiers(
        PSP,
        WETH,
        SwapSide.BUY,
        blocknumber,
      );
      console.log('PSP <> WETH Pool Identifiers: ', pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await balancerV2.getPricesVolume(
        PSP,
        WETH,
        amounts,
        SwapSide.BUY,
        blocknumber,
        pools,
      );
      console.log('PSP <> WETH Pool Prices: ', poolPrices);

      expect(poolPrices).not.toBeNull();

      const onChainPrices = await getOnChainPricingForWeightedPool(
        balancerV2,
        blocknumber,
        poolPrices![0],
        amounts,
        PSP.address,
        WETH.address,
        SwapSide.BUY,
      );

      console.log('PSP <> WETH on-chain prices: ', onChainPrices);

      expect(onChainPrices).toEqual(poolPrices![0].prices);

      await balancerV2.releaseResources();
    });

    it('SELL getPoolIdentifiers and getPricesVolume for PSP -> WETH', async function () {
      const PSP = Tokens[Network.MAINNET]['PSP'];
      const WETH = Tokens[Network.MAINNET]['WETH'];

      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      await balancerV2.initializePricing(blocknumber);

      const pools = await balancerV2.getPoolIdentifiers(
        PSP,
        WETH,
        SwapSide.SELL,
        blocknumber,
      );
      console.log('PSP <> WETH Pool Identifiers: ', pools);

      expect(pools.length).toBeGreaterThan(0);

      const poolPrices = await balancerV2.getPricesVolume(
        PSP,
        WETH,
        amounts,
        SwapSide.SELL,
        blocknumber,
        pools,
      );
      console.log('PSP <> WETH Pool Prices: ', poolPrices);

      expect(poolPrices).not.toBeNull();

      const onChainPrices = await getOnChainPricingForWeightedPool(
        balancerV2,
        blocknumber,
        poolPrices![0],
        amounts,
        PSP.address,
        WETH.address,
        SwapSide.SELL,
      );

      console.log('PSP <> WETH on-chain prices: ', onChainPrices);

      expect(onChainPrices).toEqual(poolPrices![0].prices);

      await balancerV2.releaseResources();
    });

    it('getTopPoolsForToken', async function () {
      const WETH = Tokens[Network.MAINNET]['WETH'];

      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      await balancerV2.initializePricing(blocknumber);

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
      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      await balancerV2.initializePricing(blocknumber);

      //daniel: pricing for BPT swaps has been removed for the time being
      //focus on main tokens swaps
      /*const pools = await balancerV2.getPoolIdentifiers(
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
      checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);*/

      await balancerV2.releaseResources();
    });

    it('getTopPoolsForToken', async function () {
      const BBADAI = Tokens[Network.MAINNET]['BBADAI'];
      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      const poolLiquidity = await balancerV2.getTopPoolsForToken(
        BBADAI.address,
        10,
      );
      console.log('BBADAI Top Pools:', poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, BBADAI.address, dexKey);
    });

    // it('applies getRate to phantom bpt scaling factor', async function () {
    //   const config = BalancerConfig[dexKey][Network.MAINNET];
    //   const dexHelper = new DummyDexHelper(Network.MAINNET);
    //   const tokens = Tokens[Network.MAINNET];
    //   const logger = dexHelper.getLogger(dexKey);
    //   const blocknumber = 15731000;
    //
    //   const balancerPools = new BalancerV2EventPool(
    //     dexKey,
    //     Network.MAINNET,
    //     config.vaultAddress,
    //     config.subgraphURL,
    //     dexHelper,
    //     logger,
    //   );
    //
    //   const state = await balancerPools.getOnChainState(
    //     [
    //       {
    //         id: BBAUSDT_PoolId,
    //         address: tokens.BBAUSDT.address,
    //         poolType: BalancerPoolTypes.AaveLinear,
    //         mainIndex: 1,
    //         wrappedIndex: 0,
    //         tokens: [tokens.BBAUSDT, tokens.aUSDT, tokens.USDT],
    //         mainTokens: [],
    //       },
    //     ],
    //     blocknumber,
    //   );
    //
    //   expect(
    //     state[tokens.BBAUSDT.address].tokens[
    //       tokens.BBAUSDT.address
    //     ].scalingFactor!.toString(),
    //   ).toBe('1015472217207213567');
    // });
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
    //   const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
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

    //   await balancerV2.releaseResources();
    // });

    it('getTopPoolsForToken', async function () {
      const BBAUSD = Tokens[Network.MAINNET]['BBAUSD'];
      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);

      const poolLiquidity = await balancerV2.getTopPoolsForToken(
        BBAUSD.address,
        10,
      );
      console.log('BBAUSD Top Pools:', poolLiquidity);

      checkPoolsLiquidity(poolLiquidity, BBAUSD.address, dexKey);
    });

    // it('applies getRate to phantom bpt scaling factor', async function () {
    //   const config = BalancerConfig[dexKey][Network.MAINNET];
    //   const dexHelper = new DummyDexHelper(Network.MAINNET);
    //   const tokens = Tokens[Network.MAINNET];
    //   const logger = dexHelper.getLogger(dexKey);
    //   const blocknumber = 15731000;
    //
    //   const balancerPools = new BalancerV2EventPool(
    //     dexKey,
    //     Network.MAINNET,
    //     config.vaultAddress,
    //     config.subgraphURL,
    //     dexHelper,
    //     logger,
    //   );
    //
    //   const state = await balancerPools.getOnChainState(
    //     [
    //       {
    //         id: BBAUSD_PoolId,
    //         address: BBAUSD.address,
    //         poolType: BalancerPoolTypes.StablePhantom,
    //         mainIndex: 0,
    //         wrappedIndex: 0,
    //         tokens: [
    //           tokens.BBAUSDT,
    //           tokens.BBAUSD,
    //           tokens.BBADAI,
    //           tokens.BBAUSDC,
    //         ],
    //         mainTokens: [],
    //       },
    //     ],
    //     blocknumber,
    //   );
    //
    //   expect(
    //     state[BBAUSD.address].tokens[BBAUSD.address].scalingFactor!.toString(),
    //   ).toBe('1015093119997891367');
    // });
  });
});

describe('BeetsFi', () => {
  it('FTM -> BOO: getPoolIdentifiers and getPricesVolume', async () => {
    const dexKey = 'BeetsFi';
    const network = Network.FANTOM;
    const srcToken = Tokens[network]['FTM'];
    const destToken = Tokens[network]['BOO'];
    const amounts = [0n, BI_POWS[18]];

    const dexHelper = new DummyDexHelper(network);
    const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const beetsFi = new BalancerV2(network, dexKey, dexHelper);

    await beetsFi.initializePricing(blockNumber);

    const pools = await beetsFi.getPoolIdentifiers(
      srcToken,
      destToken,
      SwapSide.SELL,
      blockNumber,
    );
    console.log('Pool Identifiers: ', pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await beetsFi.getPricesVolume(
      srcToken,
      destToken,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log('Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

    await beetsFi.releaseResources();
  });
  it('WETH -> FTM: getPoolIdentifiers and getPricesVolume', async () => {
    const dexKey = 'BeetsFi';
    const network = Network.FANTOM;
    const srcToken = Tokens[network]['WETH'];
    const destToken = Tokens[network]['FTM'];
    const amounts = [0n, BI_POWS[18]];

    const dexHelper = new DummyDexHelper(network);
    const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    const beetsFi = new BalancerV2(network, dexKey, dexHelper);

    await beetsFi.initializePricing(blockNumber);

    const pools = await beetsFi.getPoolIdentifiers(
      srcToken,
      destToken,
      SwapSide.SELL,
      blockNumber,
    );
    console.log('Pool Identifiers: ', pools);

    expect(pools.length).toBeGreaterThan(0);

    const poolPrices = await beetsFi.getPricesVolume(
      srcToken,
      destToken,
      amounts,
      SwapSide.SELL,
      blockNumber,
      pools,
    );
    console.log('Pool Prices: ', poolPrices);

    expect(poolPrices).not.toBeNull();
    checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

    await beetsFi.releaseResources();
  });
});
