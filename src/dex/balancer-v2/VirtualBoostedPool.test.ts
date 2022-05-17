import dotenv from 'dotenv';
dotenv.config();

import { Interface } from '@ethersproject/abi';
import { BalancerV2 } from './balancer-v2';
import { DummyDexHelper } from '../../dex-helper';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, SwapSide, ProviderURL, MAX_INT } from '../../constants';
import { OptimizedBalancerV2Data, SwapTypes, BalancerV2Data } from './types';
import { JsonRpcProvider } from '@ethersproject/providers';
import VaultABI from '../../abi/balancer-v2/vault.json';
import MetaStablePoolABI from '../../abi/balancer-v2/meta-stable-pool.json';
import LinearPoolABI from '../../abi/balancer-v2/linearPoolAbi.json';
import { Contract } from '@ethersproject/contracts';
import { ExchangePrices, PoolPrices, Token } from '../../types';
import { VirtualBoostedPool, VirtualBoostedPools } from './VirtualBoostedPool';

jest.setTimeout(50 * 1000);

const network = Network.MAINNET;
const vaultAddress = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
const tokens = Tokens[Network.MAINNET];
const holders = Holders[Network.MAINNET];
let vaultContract: Contract;
let balancer: BalancerV2;
let blocknumber: number;
let virtualBoostedPools: VirtualBoostedPools;
const vaultInterface = new Interface(VaultABI);
const linearPoolInterface = new Interface(LinearPoolABI);
const phantomPoolInterface = new Interface(MetaStablePoolABI);

// bbausd is an existing boostedPool
const bbausdId =
  '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe';
const bbausdAddr = '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2';
const bbausdBoostedPools = [
  {
    id: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
    address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
    poolType: 'StablePhantom',
    tokens: [
      {
        address: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
        decimals: 18,
      },
      {
        address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
        decimals: 18,
      },
      {
        address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
        decimals: 18,
      },
      {
        address: '0x9210f1204b5a24742eba12f710636d76240df3d0',
        decimals: 18,
      },
    ],
    mainIndex: 0,
    wrappedIndex: 0,
    totalLiquidity: '293579915.2360696657206036962084216',
  },
  {
    id: '0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc',
    address: '0x9210f1204b5a24742eba12f710636d76240df3d0',
    poolType: 'AaveLinear',
    tokens: [
      {
        address: '0x9210f1204b5a24742eba12f710636d76240df3d0',
        decimals: 18,
      },
      {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimals: 6,
      },
      {
        address: '0xd093fa4fb80d09bb30817fdcd442d4d02ed3e5de',
        decimals: 6,
      },
    ],
    mainIndex: 1,
    wrappedIndex: 2,
    totalLiquidity: '104733467.1251596380810596006678668',
  },
  {
    id: '0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb',
    address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
    poolType: 'AaveLinear',
    tokens: [
      {
        address: '0x02d60b84491589974263d922d9cc7a3152618ef6',
        decimals: 18,
      },
      {
        address: '0x6b175474e89094c44da98b954eedeac495271d0f',
        decimals: 18,
      },
      {
        address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
        decimals: 18,
      },
    ],
    mainIndex: 1,
    wrappedIndex: 0,
    totalLiquidity: '104733467.1251596380810596006678668',
  },
  {
    id: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c0000000000000000000000fd',
    address: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
    poolType: 'AaveLinear',
    tokens: [
      {
        address: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
        decimals: 18,
      },
      {
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        decimals: 6,
      },
      {
        address: '0xf8fd466f12e236f4c96f7cce6c79eadb819abf58',
        decimals: 6,
      },
    ],
    mainIndex: 1,
    wrappedIndex: 2,
    totalLiquidity: '104733467.1251596380810596006678668',
  },
];

// getPricesVolume with option to remove specified tokens from limit param
async function getPrices(
  balancer: BalancerV2,
  blocknumber: number,
  from: Token,
  to: Token,
  amounts: bigint[],
  poolsToRemove?: string[],
): Promise<null | ExchangePrices<BalancerV2Data>> {
  const pools = await balancer.getPoolIdentifiers(
    from,
    to,
    SwapSide.SELL,
    blocknumber,
  );

  const allowedPools = poolsToRemove
    ? pools.filter(pool => {
        return !poolsToRemove.includes(pool);
      })
    : pools;

  const prices = await balancer.getPricesVolume(
    from,
    to,
    amounts,
    SwapSide.SELL,
    blocknumber,
    allowedPools,
  );
  return prices;
}

// Compare calculated price to queryBatchSwap call using swaps created in params
async function compareOnChain(
  p: PoolPrices<any>,
  amount: BigInt,
  fromAddr: string,
  toAddr: string,
  holder: string,
  swapType: SwapTypes,
) {
  // Get balancers params
  const data: OptimizedBalancerV2Data = {
    swaps: [
      {
        poolId: p.data.poolId,
        amount: amount.toString(),
      },
    ],
  };
  // [swapType, swaps[], assets, funds, limits[], timeout]
  const param = balancer.getBalancerParam(
    fromAddr,
    toAddr,
    '', // These aren't used
    '',
    data,
    swapType === SwapTypes.SwapExactIn ? SwapSide.SELL : SwapSide.BUY,
  );
  const funds = {
    sender: holder,
    recipient: holder,
    fromInternalBalance: false,
    toInternalBalance: false,
  };
  // query result onchain
  const deltas = await vaultContract.callStatic.queryBatchSwap(
    swapType,
    param[1],
    param[2],
    funds,
  );
  expect(deltas[0].toString()).toEqual(amount.toString());
  expect(deltas[1].toString()).toEqual((p.prices[1] * BigInt(-1)).toString());
}

describe('VirtualBoostedPools', () => {
  beforeAll(async () => {
    const provider = new JsonRpcProvider(ProviderURL[network]);
    vaultContract = new Contract(vaultAddress, VaultABI, provider);
    const dexHelper = new DummyDexHelper(Network.MAINNET);
    blocknumber = await dexHelper.provider.getBlockNumber();
    balancer = new BalancerV2(Network.MAINNET, 'BalancerV2', dexHelper);
    await balancer.setupEventPools(blocknumber);
    // Create virtual boosted pool info using bbausd subgraph data
    virtualBoostedPools = VirtualBoostedPool.createPools(bbausdBoostedPools);
  });

  describe('helpers', () => {
    it('createVirtualBoostedPools, dictionary pools', () => {
      const bbausd = virtualBoostedPools.dictionary[bbausdId];
      expect(bbausd).not.toBeNull();
      expect(bbausd.mainTokens.length).toBe(3);
      expect(bbausd.mainTokens[0].address).toBe(tokens['USDT'].address);
      expect(bbausd.mainTokens[0].decimals).toBe(tokens['USDT'].decimals);
      expect(bbausd.mainTokens[0].linearPoolAddr).toBe(
        '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
      );
      expect(bbausd.mainTokens[0].linearPoolId).toBe(
        '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c0000000000000000000000fd',
      );
      expect(bbausd.mainTokens[1].address).toBe(tokens['DAI'].address);
      expect(bbausd.mainTokens[1].decimals).toBe(tokens['DAI'].decimals);
      expect(bbausd.mainTokens[1].linearPoolAddr).toBe(
        '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
      );
      expect(bbausd.mainTokens[1].linearPoolId).toBe(
        '0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb',
      );
      expect(bbausd.mainTokens[2].address).toBe(tokens['USDC'].address);
      expect(bbausd.mainTokens[2].decimals).toBe(tokens['USDC'].decimals);
      expect(bbausd.mainTokens[2].linearPoolAddr).toBe(
        '0x9210f1204b5a24742eba12f710636d76240df3d0',
      );
      expect(bbausd.mainTokens[2].linearPoolId).toBe(
        '0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc',
      );
    });

    it('createVirtualBoostedPools, subgraph pools', () => {
      const subgraphPools = virtualBoostedPools.subgraph;
      expect(subgraphPools.length).toBe(1);
      expect(subgraphPools[0].address).toBe(
        bbausdAddr + VirtualBoostedPool.poolType.toLowerCase(),
      );
      expect(subgraphPools[0].id).toBe(
        bbausdId + VirtualBoostedPool.poolType.toLowerCase(),
      );
      expect(subgraphPools[0].poolType).toBe('VirtualBoosted');
      expect(subgraphPools[0].totalLiquidity).toBe(
        '293579915.2360696657206036962084216',
      );
      expect(subgraphPools[0].tokens.length).toBe(3);
      expect(subgraphPools[0].tokens[0].address).toBe(tokens['USDT'].address);
      expect(subgraphPools[0].tokens[0].decimals).toBe(tokens['USDT'].decimals);
      expect(subgraphPools[0].tokens[1].address).toBe(tokens['DAI'].address);
      expect(subgraphPools[0].tokens[1].decimals).toBe(tokens['DAI'].decimals);
      expect(subgraphPools[0].tokens[2].address).toBe(tokens['USDC'].address);
      expect(subgraphPools[0].tokens[2].decimals).toBe(tokens['USDC'].decimals);
    });

    it('parsePoolPairData', () => {
      const tokenInAddr = tokens['DAI'].address;
      const tokenOutAddr = tokens['USDC'].address;
      const virtualBoostedPool = new VirtualBoostedPool(
        vaultAddress,
        vaultInterface,
        linearPoolInterface,
        phantomPoolInterface,
      );
      const poolPairData = virtualBoostedPool.parsePoolPairData(
        virtualBoostedPools.subgraph[0],
        {},
        tokenInAddr,
        tokenOutAddr,
        virtualBoostedPools.dictionary,
      );
      expect(poolPairData.tokenIn).toBe(tokenInAddr);
      expect(poolPairData.tokenOut).toBe(tokenOutAddr);
      expect(poolPairData.phantomPoolId).toBe(bbausdId);
    });

    describe('checkBalance', () => {
      const tokenOutBalanceScaled = BigInt(2900000000000000000000000);
      const poolState = {
        '0x9210f1204b5a24742eba12f710636d76240df3d0': {
          swapFee: BigInt(200000000000000),
          mainIndex: 1,
          wrappedIndex: 2,
          bptIndex: 0,
          lowerTarget: BigInt(2900000000000000000000000),
          upperTarget: BigInt(10000000000000000000000000),
          tokens: {
            '0x9210f1204b5a24742eba12f710636d76240df3d0': {
              balance: BigInt(5192296754551644979080162077402160),
              scalingFactor: BigInt(1000000000000000000),
            },
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
              balance: BigInt(2900000000000),
              scalingFactor: BigInt(1000000000000000000000000000000),
            },
            '0xd093fa4fb80d09bb30817fdcd442d4d02ed3e5de': {
              balance: BigInt(94861903431317),
              scalingFactor: BigInt(1074097876816060575000000000000),
            },
          },
          gasCost: 60000,
        },
      };

      it('above limit', () => {
        const tokenInAddr = tokens['DAI'].address;
        const tokenOutAddr = tokens['USDC'].address;
        const virtualBoostedPool = new VirtualBoostedPool(
          vaultAddress,
          vaultInterface,
          linearPoolInterface,
          phantomPoolInterface,
        );
        const poolPairData = virtualBoostedPool.parsePoolPairData(
          virtualBoostedPools.subgraph[0],
          poolState,
          tokenInAddr,
          tokenOutAddr,
          virtualBoostedPools.dictionary,
        );
        const check = virtualBoostedPool.checkBalance(
          [tokenOutBalanceScaled],
          BigInt(0),
          SwapSide.SELL,
          poolPairData,
        );
        expect(check).toBe(false);
      });

      it('below limit', () => {
        const tokenInAddr = tokens['DAI'].address;
        const tokenOutAddr = tokens['USDC'].address;
        const virtualBoostedPool = new VirtualBoostedPool(
          vaultAddress,
          vaultInterface,
          linearPoolInterface,
          phantomPoolInterface,
        );
        const poolPairData = virtualBoostedPool.parsePoolPairData(
          virtualBoostedPools.subgraph[0],
          poolState,
          tokenInAddr,
          tokenOutAddr,
          virtualBoostedPools.dictionary,
        );
        const check = virtualBoostedPool.checkBalance(
          [(tokenOutBalanceScaled * BigInt(98)) / BigInt(100)], // 98% of balance
          BigInt(0),
          SwapSide.SELL,
          poolPairData,
        );
        expect(check).toBe(true);
      });
    });

    it('getSwapData, invalid tokens', () => {
      const tokenInAddr = tokens['WETH'].address;
      const tokenOutAddr = tokens['USDC'].address;
      const amount = '1';
      expect(() =>
        VirtualBoostedPool.getSwapData(
          tokenInAddr,
          tokenOutAddr,
          bbausdId + VirtualBoostedPool.poolType.toLowerCase(),
          amount,
          virtualBoostedPools.dictionary,
        ),
      ).toThrowError('Token missing');
    });

    it('getSwapData, invalid id', () => {
      const tokenInAddr = tokens['DAI'].address;
      const tokenOutAddr = tokens['USDC'].address;
      const amount = '1';
      expect(() =>
        VirtualBoostedPool.getSwapData(
          tokenInAddr,
          tokenOutAddr,
          'wrongid',
          amount,
          virtualBoostedPools.dictionary,
        ),
      ).toThrowError('Invalid VirtualBoostedPool ID');
    });

    it('getSwapData', () => {
      const tokenInAddr = tokens['DAI'].address;
      const tokenOutAddr = tokens['USDC'].address;
      const amount = '1';
      const swapData = VirtualBoostedPool.getSwapData(
        tokenInAddr,
        tokenOutAddr,
        bbausdId + VirtualBoostedPool.poolType.toLowerCase(),
        amount,
        virtualBoostedPools.dictionary,
      );

      expect(swapData.assets).toEqual([
        tokenInAddr,
        '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
        '0x9210f1204b5a24742eba12f710636d76240df3d0',
        tokenOutAddr,
      ]);
      expect(swapData.swaps).toEqual([
        {
          poolId:
            '0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb',
          assetInIndex: 0,
          assetOutIndex: 1,
          amount: amount,
          userData: '0x',
        },
        {
          poolId:
            '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
          assetInIndex: 1,
          assetOutIndex: 2,
          amount: '0',
          userData: '0x',
        },
        {
          poolId:
            '0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc',
          assetInIndex: 2,
          assetOutIndex: 3,
          amount: '0',
          userData: '0x',
        },
      ]);
    });
  });

  describe('test pricing vs onchain', () => {
    describe('calculated prices should match queryBatchSwap delta', () => {
      it('has all VirtualBoostedPools in limit list', async () => {
        const swapType = SwapTypes.SwapExactIn;
        const from = tokens['DAI'];
        const to = tokens['USDC'];
        const holder = holders['DAI'];
        const amount = BigInt('1000000000000000000');

        // fetch calculated prices to compare
        const prices = await getPrices(balancer, blocknumber, from, to, [
          BigInt('0'),
          amount,
        ]);
        expect(prices).not.toBeNull();
        if (!prices) return;
        for (let p of prices)
          compareOnChain(p, amount, from.address, to.address, holder, swapType);
      });

      it('has bbausd VirtualBoostedPools missing internal pool in limit list', async () => {
        const swapType = SwapTypes.SwapExactIn;
        const from = tokens['DAI'];
        const to = tokens['USDC'];
        const holder = holders['DAI'];
        const amount = BigInt('1000000000000000000');

        // fetch calculated prices to compare
        const prices = await getPrices(
          balancer,
          blocknumber,
          from,
          to,
          [BigInt('0'), amount],
          ['BalancerV2_0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c'],
        ); // Removing a bbausd internal pool
        expect(prices).not.toBeNull();
        prices?.forEach(p => {
          expect(p.poolIdentifier).not.toEqual(
            'BalancerV2_0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2virtualboosted',
          ); // Should not have boosted pool price
          expect(p.data.poolId).not.toEqual(
            '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fevirtualboosted',
          ); // Should not have boosted pool price
        });
        if (!prices) return;
        for (let p of prices)
          compareOnChain(p, amount, from.address, to.address, holder, swapType);
      });
    });
  });
});
