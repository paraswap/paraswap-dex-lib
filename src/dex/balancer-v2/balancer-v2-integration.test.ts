/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BalancerV2, BalancerV2EventPool } from './balancer-v2';
import { checkPoolPrices, checkPoolsLiquidity } from '../../../tests/utils';
import { BI_POWS } from '../../bigint-constants';
import { BalancerConfig } from './config';
import { Tokens } from '../../../tests/constants-e2e';
import { BalancerPoolTypes, BalancerV2Data, OptimizedBalancerV2Data } from './types';
import { PoolPrices } from '../../types';

const WETH = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  decimals: 18,
};

const DAI = {
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  decimals: 18,
};

const BBADAI = {
  address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
  decimals: 18,
};

const BBAUSD = {
  address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
  decimals: 18,
};

const MIMATIC = {
  address: '0xa3fa99a148fa48d14ed51d610c367c61876997f1',
  decimals: 18,
};
const USDC = {
  address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  decimals: 6,
};

const BBAUSD_PoolId =
  '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe';
const BBAUSDT_PoolId =
  '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c0000000000000000000000fd';

const amounts = [ 0n, BI_POWS[18], 2000000000000000000n ];

const dexKey = 'BalancerV2';

async function getOnChainPricingForWeightedPool(
  balancerV2: BalancerV2,
  blockNumber: number,
  poolPrice: PoolPrices<BalancerV2Data>,
  amounts: bigint[],
  srcTokenAddress: string,
  destTokenAddress: string,
  side: SwapSide,
): Promise<BigInt[]>{

  console.log('SRC TOKEN ADDRESS: ', srcTokenAddress);
  console.log('DST TOKEN ADDRESS: ', destTokenAddress);

  return Promise.all(poolPrice.prices.map(async (price, index) => {

    if(amounts[index] === 0n) {
      return Promise.resolve(0n);
    }

    const swaps = [
      { poolId: poolPrice.data.poolId, amount: amounts[index].toString() },
    ];

    const data = { swaps };

    const params = balancerV2.getBalancerParam(
      srcTokenAddress,
      destTokenAddress,
      '0',
      '0',
      data as unknown as OptimizedBalancerV2Data,
      side,
    );

    let calldata = [
      {
        target: balancerV2.vaultAddress,
        callData: balancerV2.eventPools.vaultInterface.encodeFunctionData('queryBatchSwap', params.slice(0, 4)),
      },
    ];

    const results = (
      await balancerV2.dexHelper.multiContract.methods
        .aggregate(calldata)
        .call({}, blockNumber)
    ).returnData;

    const parsed = balancerV2.eventPools.vaultInterface.decodeFunctionResult('queryBatchSwap', results[0]);
    console.log('PARAMS: ', params.slice(0, 4));
    console.log('RESULT: ', BigInt(parsed[0][0]._hex));
    console.log('=======================================');
    return BigInt(parsed[0][0]._hex);
  }));
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

    it('SELL getPoolIdentifiers and getPricesVolume WETH -> DAI', async function () {
      const dexHelper = new DummyDexHelper(Network.MAINNET);
      const blocknumber = await dexHelper.web3Provider.eth.getBlockNumber();
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

      await balancerV2.releaseResources();
    });

    it('BUY getPoolIdentifiers and getPricesVolume for PSP -> WETH', async function () {
      // const amounts = [0n, 500000000000n, 200000000000000n, 10000000000000000000n ];

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

      checkPoolPrices(poolPrices!, amounts, SwapSide.BUY, dexKey);

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
      // const amounts = [0n, 20000000000000n, 40000000000000n, 60000000000000n ];

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
      // checkPoolPrices(poolPrices!, amounts, SwapSide.SELL, dexKey);

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

    // it('getTopPoolsForToken', async function () {
    //   const dexHelper = new DummyDexHelper(Network.MAINNET);
    //   const balancerV2 = new BalancerV2(Network.MAINNET, dexKey, dexHelper);
    //
    //   const poolLiquidity = await balancerV2.getTopPoolsForToken(
    //     WETH.address,
    //     10,
    //   );
    //   console.log('WETH Top Pools:', poolLiquidity);
    //
    //   checkPoolsLiquidity(poolLiquidity, WETH.address, dexKey);
    // });
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
