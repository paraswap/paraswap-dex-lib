import { Interface } from '@ethersproject/abi';
import { Network } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import {
  addressDecode,
  uint256ToBigInt,
  uint256DecodeToNumber,
} from '../../lib/decoders';
import { MultiCallParams } from '../../lib/multi-wrapper';
import { Address, PoolLiquidity, Token } from '../../types';
import { Solidly } from './solidly';

type Pool = {
  address: Address;
  token0: Token;
  token1: Token;
  reserve0: bigint;
  reserve1: bigint;
};

const SolidlyFactoryABI = [
  {
    inputs: [],
    name: 'reserve0',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'reserve1',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
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

const solidlyFactoryIface = new Interface(SolidlyFactoryABI);

export class SolidlyRpcPoolTracker extends Solidly {
  public pools: Pool[] = [];

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
  }

  // getAllPoolsCallData should be overridden in case RPC pool tracker is used
  protected getAllPoolsCallData(): MultiCallParams<number> | undefined {
    return undefined;
  }

  // getPoolCallData should be overridden in case RPC pool tracker is used
  protected getPoolCallData(
    index: number,
  ): MultiCallParams<string> | undefined {
    return undefined;
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    await this.updatePools();
    const token = tokenAddress.toLowerCase();

    let pools = this.pools.filter(
      pool => pool.token0.address === token || pool.token1.address === token,
    );

    if (pools.length === 0) {
      return [];
    }

    pools = await this.updatePoolsReserves(pools.map(pool => pool.address));

    const tokensAmounts = pools
      .map(pool => {
        const token0 = pool.token0.address;
        const token1 = pool.token1.address;
        const reserve0 = pool.reserve0;
        const reserve1 = pool.reserve1;

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

  async updatePools() {
    const allPoolsCallData = this.getAllPoolsCallData();
    if (!allPoolsCallData) {
      throw new Error('getAllPoolsCallData is not implemented');
    }

    const callData: MultiCallParams<number>[] = [allPoolsCallData];

    const [allPoolsLength] =
      await this.dexHelper.multiWrapper.tryAggregate<number>(true, callData);

    if (this.pools.length < allPoolsLength.returnData) {
      await this.initPools(this.pools.length, allPoolsLength.returnData);
    }
  }

  async initPools(fromIndex: number, toIndex: number) {
    const allPoolsCallData: MultiCallParams<string>[] = [];
    for (let i = fromIndex; i < toIndex; i++) {
      const poolCallData = this.getPoolCallData(i);
      if (!poolCallData) {
        throw new Error('getPoolCallData is not implemented');
      }
      allPoolsCallData.push(poolCallData);
    }

    const allPoolsResults =
      await this.dexHelper.multiWrapper.tryAggregate<string>(
        true,
        allPoolsCallData,
      );

    const poolsCalldata: MultiCallParams<string | bigint>[] = [];

    for (const poolResult of allPoolsResults) {
      poolsCalldata.push(
        {
          target: poolResult.returnData,
          callData: solidlyFactoryIface.encodeFunctionData('token0', []),
          decodeFunction: addressDecode,
        },
        {
          target: poolResult.returnData,
          callData: solidlyFactoryIface.encodeFunctionData('token1', []),
          decodeFunction: addressDecode,
        },
        {
          target: poolResult.returnData,
          callData: solidlyFactoryIface.encodeFunctionData('reserve0', []),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: poolResult.returnData,
          callData: solidlyFactoryIface.encodeFunctionData('reserve1', []),
          decodeFunction: uint256ToBigInt,
        },
      );
    }

    const pools = await this.dexHelper.multiWrapper.tryAggregate<
      string | bigint
    >(true, poolsCalldata);

    this.pools = [];

    const tokensSet = new Set<string>();
    for (let i = 0; i < allPoolsResults.length; i++) {
      const token0 = (pools[i * 4].returnData as string).toLowerCase();
      const token1 = (pools[i * 4 + 1].returnData as string).toLowerCase();

      tokensSet.add(token0.toLowerCase());
      tokensSet.add(token1.toLowerCase());
    }

    const decimalsCalldata: MultiCallParams<number>[] = [];
    const tokens = Array.from(tokensSet);

    for (const token of tokens) {
      decimalsCalldata.push({
        target: token,
        callData: solidlyFactoryIface.encodeFunctionData('decimals', []),
        decodeFunction: uint256DecodeToNumber,
      });
    }

    const decimalsResults =
      await this.dexHelper.multiWrapper.tryAggregate<number>(
        true,
        decimalsCalldata,
      );

    const decimals = decimalsResults.reduce((acc, result, index) => {
      const token = tokens[index];
      acc[token] = result.returnData;
      return acc;
    }, {} as Record<string, number>);

    for (let i = 0; i < allPoolsResults.length; i++) {
      const poolAddress = allPoolsResults[i].returnData.toLowerCase();
      const token0 = (pools[i * 4].returnData as string).toLowerCase();
      const token1 = (pools[i * 4 + 1].returnData as string).toLowerCase();
      const reserve0 = pools[i * 4 + 2].returnData as bigint;
      const reserve1 = pools[i * 4 + 3].returnData as bigint;

      this.pools.push({
        address: poolAddress,
        token0: {
          address: token0,
          decimals: decimals[token0],
        },
        token1: {
          address: token1,
          decimals: decimals[token1],
        },
        reserve0,
        reserve1,
      });
    }
  }

  async updatePoolsReserves(pools: string[]): Promise<Pool[]> {
    const callData: MultiCallParams<string | bigint>[] = [];

    for (const pool of pools) {
      callData.push(
        {
          target: pool,
          callData: solidlyFactoryIface.encodeFunctionData('reserve0', []),
          decodeFunction: uint256ToBigInt,
        },
        {
          target: pool,
          callData: solidlyFactoryIface.encodeFunctionData('reserve1', []),
          decodeFunction: uint256ToBigInt,
        },
      );
    }

    const results = await this.dexHelper.multiWrapper.tryAggregate<
      string | bigint
    >(true, callData);

    const _pools: Pool[] = [];

    for (let i = 0; i < pools.length; i++) {
      const reserve0 = results[i * 2].returnData as bigint;
      const reserve1 = results[i * 2 + 1].returnData as bigint;

      const poolIndex = this.pools.findIndex(pool => pool.address === pools[i]);

      if (poolIndex !== -1) {
        this.pools[poolIndex].reserve0 = reserve0;
        this.pools[poolIndex].reserve1 = reserve1;

        _pools.push(this.pools[poolIndex]);
      }
    }

    return _pools;
  }
}
