import { Interface } from '@ethersproject/abi';
import { CACHE_PREFIX, Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import {
  addressDecode,
  uint256DecodeToNumber,
  generalDecoder,
} from '../../lib/decoders';
import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';
import { Address, PoolLiquidity, Token } from '../../types';
import { UniswapV2 } from './uniswap-v2';
import { BytesLike } from 'ethers';

type CachedPool = {
  address: Address;
  token0: Token;
  token1: Token;
};

type Pool = {
  address: Address;
  token0: Token;
  token1: Token;
  reserves: {
    updatedAt: null | number;
    reserve0: bigint;
    reserve1: bigint;
  };
};

const UPDATE_POOL_INTERVAL = 10 * 60 * 1000; // 10 minutes
const BATCH_SIZE = 1000;

const FactoryABI = [
  {
    constant: true,
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'allPairs',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'allPairsLength',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'getReserves',
    outputs: [
      {
        internalType: 'uint112',
        name: '_reserve0',
        type: 'uint112',
      },
      {
        internalType: 'uint112',
        name: '_reserve1',
        type: 'uint112',
      },
      {
        internalType: 'uint32',
        name: '_blockTimestampLast',
        type: 'uint32',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [
      {
        internalType: 'uint8',
        name: '',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

const factoryIface = new Interface(FactoryABI);

export class UniswapV2RpcPoolTracker extends UniswapV2 {
  private cacheKey: string;
  public pools: Record<string, Pool> = {};

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected isDynamicFees = false,
  ) {
    super(
      network,
      dexKey,
      dexHelper,
      isDynamicFees, // dynamic fees
    );

    this.cacheKey = `${CACHE_PREFIX}_${this.dexKey}_pools`.toLowerCase();
  }

  async initializePricing() {
    if (!this.dexHelper.config.isSlave) {
      await this.updatePools(true);

      setInterval(async () => {
        await this.updatePools();
      }, UPDATE_POOL_INTERVAL);
    }
  }

  async updatePools(initialize = false) {
    const allPools = await this.getAllPoolsLength();
    const allCachedPools = await this.dexHelper.cache.hlen(this.cacheKey);

    const missingPools = allPools - allCachedPools;

    if (!initialize && missingPools > 1_000) {
      throw new Error(
        `Missing ${missingPools} out of ${allPools} pools. Cache is not up to date, reverting... `,
      );
    }

    if (allPools > allCachedPools) {
      await this.initPools(allCachedPools, allPools);
    }
  }

  async initPools(fromIndex: number, toIndex: number) {
    this.logger.info(`Initializing pools from ${fromIndex} to ${toIndex}...`);

    for (let i = fromIndex; i < toIndex; i += BATCH_SIZE) {
      this.logger.info(
        `Fetching pools from ${i} to ${Math.min(i + BATCH_SIZE, toIndex)}`,
      );

      const fetchedPools = await this.fetchPools(
        i,
        Math.min(i + BATCH_SIZE, toIndex),
      );
      const pools = Object.fromEntries(
        Object.entries(fetchedPools).map(([key, value]) => [
          key,
          JSON.stringify(value),
        ]),
      );
      await this.dexHelper.cache.hmset(this.cacheKey, pools);
    }

    this.logger.info(
      `Fetched ${toIndex - fromIndex} pools from ${fromIndex} to ${toIndex}`,
    );
  }

  async getCachedPools(fromIndex: number, toIndex: number) {
    for (
      let batchStart = fromIndex;
      batchStart < toIndex;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, toIndex);
      const keys = [];
      for (let i = batchStart; i < batchEnd; i++) {
        keys.push(i.toString());
      }
      const pools = await this.dexHelper.cache.hmget(this.cacheKey, keys);

      pools.forEach((pool, idx) => {
        const index = batchStart + idx;
        this.pools[index] = pool
          ? {
              ...JSON.parse(pool),
              reserves: {
                reserve0: 0n,
                reserve1: 0n,
                updatedAt: null,
              },
            }
          : null;
      });
    }
  }

  async updatePoolState() {
    await this.updatePools();

    const allPools = Object.keys(this.pools).length;
    const allCachedPools = await this.dexHelper.cache.hlen(this.cacheKey);

    if (allPools < allCachedPools) {
      await this.getCachedPools(allPools, allCachedPools);
    }
  }

  async getAllPoolsLength() {
    const allPoolsCallData = {
      target: this.factoryAddress,
      callData: factoryIface.encodeFunctionData('allPairsLength', []),
      decodeFunction: uint256DecodeToNumber,
    };

    if (!allPoolsCallData) {
      throw new Error('getAllPoolsCallData is not implemented');
    }

    const callData: MultiCallParams<number>[] = [allPoolsCallData];

    const [allPoolsLength] =
      await this.dexHelper.multiWrapper.tryAggregate<number>(true, callData);

    return allPoolsLength.returnData;
  }

  async fetchPools(fromIndex: number, toIndex: number) {
    const allPoolsCallData: MultiCallParams<string>[] = [];
    for (let i = fromIndex; i < toIndex; i++) {
      const poolCallData = {
        target: this.factoryAddress,
        callData: factoryIface.encodeFunctionData('allPairs', [i]),
        decodeFunction: addressDecode,
      };

      allPoolsCallData.push(poolCallData);
    }

    const allPoolsResults =
      await this.dexHelper.multiWrapper.tryAggregate<string>(
        true,
        allPoolsCallData,
      );

    const poolsCalldata: MultiCallParams<string | bigint[]>[] = [];

    for (const poolResult of allPoolsResults) {
      poolsCalldata.push(
        {
          target: poolResult.returnData,
          callData: factoryIface.encodeFunctionData('token0', []),
          decodeFunction: addressDecode,
        },
        {
          target: poolResult.returnData,
          callData: factoryIface.encodeFunctionData('token1', []),
          decodeFunction: addressDecode,
        },
      );
    }

    const poolsData = await this.dexHelper.multiWrapper.tryAggregate<
      string | bigint[]
    >(true, poolsCalldata);

    const tokensSet = new Set<string>();
    for (let i = 0; i < allPoolsResults.length; i++) {
      const token0 = (poolsData[i * 2].returnData as string).toLowerCase();
      const token1 = (poolsData[i * 2 + 1].returnData as string).toLowerCase();

      tokensSet.add(token0.toLowerCase());
      tokensSet.add(token1.toLowerCase());
    }

    const decimalsCalldata: MultiCallParams<number>[] = [];
    const tokens = Array.from(tokensSet);

    for (const token of tokens) {
      decimalsCalldata.push({
        target: token,
        callData: factoryIface.encodeFunctionData('decimals', []),
        decodeFunction: uint256DecodeToNumber,
      });
    }

    const decimalsResults =
      await this.dexHelper.multiWrapper.tryAggregate<number>(
        false,
        decimalsCalldata,
      );

    const decimals = decimalsResults.reduce((acc, result, index) => {
      const token = tokens[index];
      acc[token] = result.returnData || 18; // default to 18 decimals if not found
      return acc;
    }, {} as Record<string, number>);

    const pools: Record<string, CachedPool> = {};

    for (let i = 0; i < allPoolsResults.length; i++) {
      const poolAddress = allPoolsResults[i].returnData.toLowerCase();
      const token0 = (poolsData[i * 2].returnData as string).toLowerCase();
      const token1 = (poolsData[i * 2 + 1].returnData as string).toLowerCase();
      // const [reserve0, reserve1] = pools[i * 3 + 2].returnData as bigint[];

      pools[i + fromIndex] = {
        address: poolAddress,
        token0: {
          address: token0,
          decimals: decimals[token0],
        },
        token1: {
          address: token1,
          decimals: decimals[token1],
        },
      };
    }

    return pools;
  }

  async updatePoolsReserves(pools: Pool[]): Promise<void> {
    const callData: MultiCallParams<bigint[]>[] = [];

    for (const pool of pools) {
      callData.push({
        target: pool.address,
        callData: factoryIface.encodeFunctionData('getReserves', []),
        decodeFunction: (result: MultiResult<BytesLike> | BytesLike) => {
          return generalDecoder(
            result,
            ['uint112', 'uint112'],
            [0n, 0n],
            res => [BigInt(res[0]), BigInt(res[1])],
          );
        },
      });
    }

    const results = await this.dexHelper.multiWrapper.tryAggregate<bigint[]>(
      true,
      callData,
    );

    for (let i = 0; i < pools.length; i++) {
      const [reserve0, reserve1] = results[i].returnData as bigint[];
      const pool = pools[i];

      pool.reserves = {
        updatedAt: Date.now(),
        reserve0: reserve0,
        reserve1: reserve1,
      };
    }
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const token = tokenAddress.toLowerCase();

    let pools = Object.values(this.pools).filter(
      pool => pool.token0.address === token || pool.token1.address === token,
    );

    if (pools.length === 0) {
      return [];
    }

    const now = Date.now();
    const poolsToUpdate = pools.filter(
      pool =>
        !pool.reserves.updatedAt ||
        now - pool.reserves.updatedAt > UPDATE_POOL_INTERVAL,
    );

    if (poolsToUpdate.length > 0) {
      await this.updatePoolsReserves(pools);
    }

    pools = pools
      .sort((a, b) => {
        const aReserve =
          token === a.token0.address
            ? a.reserves.reserve0
            : a.reserves.reserve1;

        const bReserve =
          token === b.token0.address
            ? b.reserves.reserve0
            : b.reserves.reserve1;
        return Number(bReserve - aReserve);
      })
      .slice(0, limit);

    const tokensAmounts = pools
      .map(pool => {
        const token0 = pool.token0.address;
        const token1 = pool.token1.address;
        const reserve0 = pool.reserves.reserve0;
        const reserve1 = pool.reserves.reserve1;

        return [
          [token0, reserve0],
          [token1, reserve1],
        ] as [string, bigint | null][];
      })
      .flat();

    const usdTokenAmounts = await this.dexHelper.getUsdTokenAmounts(
      tokensAmounts,
    );

    const poolsWithLiquidity: PoolLiquidity[] = pools.map((pool, i) => {
      const connectorToken =
        token === pool.token0.address ? pool.token1 : pool.token0;

      let token0ReserveUSD = usdTokenAmounts[i * 2];
      let token1ReserveUSD = usdTokenAmounts[i * 2 + 1];

      // fallback to non-empty usd reserves
      if (!token0ReserveUSD && token1ReserveUSD) {
        token0ReserveUSD = token1ReserveUSD;
      }

      if (!token1ReserveUSD && token0ReserveUSD) {
        token1ReserveUSD = token0ReserveUSD;
      }

      return {
        exchange: this.dexKey,
        address: pool.address,
        connectorTokens: [connectorToken],
        liquidityUSD: token0ReserveUSD + token1ReserveUSD,
      };
    });

    return poolsWithLiquidity
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, limit);
  }
}
