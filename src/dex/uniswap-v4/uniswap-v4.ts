import { omit } from 'lodash';
import {
  AdapterExchangeParam,
  Address,
  DexExchangeParam,
  NumberAsString,
  Token,
} from '../../types';
import { Logger } from 'log4js';
import {
  Network,
  NULL_ADDRESS,
  SUBGRAPH_TIMEOUT,
  SwapSide,
} from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { ExchangePrices, PoolPrices, PoolLiquidity } from '../../types';
import { getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { IDex } from '../idex';
import { SimpleExchange } from '../simple-exchange';
import { UniswapV4Config } from './config';
import { Pool, UniswapV4Data, SubgraphPool } from './types';
import { BytesLike } from 'ethers';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import QuoterAbi from '../../abi/uniswap-v4/quoter.abi.json';
import { BI_POWS } from '../../bigint-constants';
import { Interface } from '@ethersproject/abi';
import { generalDecoder } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';
import { swapExactInputSingleCalldata } from './encoder';

export class UniswapV4 extends SimpleExchange implements IDex<UniswapV4Data> {
  readonly hasConstantPriceLargeAmounts = false;
  needWrapNative = false;

  logger: Logger;
  protected quoterIface: Interface;

  private pools: Pool[] = [];

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(UniswapV4Config);

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    protected router = UniswapV4Config[dexKey][network].router,
    protected quoter = UniswapV4Config[dexKey][network].quoter,
    protected poolManager = UniswapV4Config[dexKey][network].poolManager,
    protected subgraph = UniswapV4Config[dexKey][network].subgraphURL,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);

    this.quoterIface = new Interface(QuoterAbi);
  }

  async initializePricing(blockNumber: number) {
    this.pools = await this.queryAllAvailablePools();
  }

  async getPoolIdentifiers(
    from: Token,
    to: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const pools = await this.getAvailablePoolsForPair(
      from.address.toLowerCase(),
      to.address.toLowerCase(),
    );

    return pools.map(pool => pool.id);
  }

  async getPricesVolume(
    from: Token,
    to: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<ExchangePrices<UniswapV4Data> | null> {
    if (side === SwapSide.BUY) return null;

    const pools = await this.getAvailablePoolsForPair(
      from.address.toLowerCase(),
      to.address.toLowerCase(),
    );

    const availablePools =
      limitPools?.filter(t => pools.find(p => p.id === t)) ??
      pools.map(t => t.id);

    const pricesPromises = availablePools.map(async poolId => {
      const pool = pools.find(p => p.id === poolId)!;

      const zeroForOne =
        from.address.toLowerCase() === pool.key.currency0.toLowerCase() ||
        (isETHAddress(from.address) && pool.key.currency0 === NULL_ADDRESS);

      const prices = await this.queryPrice(zeroForOne, amounts, pool);

      return {
        unit: BI_POWS[to.decimals],
        prices,
        data: {
          exchange: this.dexKey,
          pool: {
            id: pool.id,
            key: omit(pool.key, ['tick', 'ticks']),
          },
          zeroForOne,
        },
        poolAddresses: [this.poolManager],
        exchange: this.dexKey,
        gasCost: 100_000,
        poolIdentifier: poolId,
      };
    });

    const prices = await Promise.all(pricesPromises);

    return prices;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<UniswapV4Data>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    count: number,
  ): Promise<PoolLiquidity[]> {
    return [];
  }

  async queryAllAvailablePools(): Promise<Pool[]> {
    let pools: SubgraphPool[] = [];
    let curPage = 0;
    const limit = 1000;
    let currentPools: SubgraphPool[] =
      await this.queryOnePageForAllAvailablePoolsFromSubgraph(
        curPage * limit,
        limit,
      );
    pools = pools.concat(currentPools);

    while (currentPools.length === limit) {
      currentPools = await this.queryOnePageForAllAvailablePoolsFromSubgraph(
        curPage * limit,
        limit,
      );

      pools = pools.concat(currentPools);
      curPage++;
    }

    return pools.map(pool => ({
      id: pool.id,
      key: {
        currency0: pool.token0.address,
        currency1: pool.token1.address,
        fee: pool.fee,
        tickSpacing: pool.tickSpacing,
        hooks: pool.hooks,
        tick: pool.tick,
        ticks: pool.ticks,
      },
    }));
  }

  async queryOnePageForAllAvailablePoolsFromSubgraph(
    skip: number,
    limit: number,
  ): Promise<SubgraphPool[]> {
    const ticksLimit = 100;

    const poolsQuery = `query ($skip: Int!) {
      pools(
        orderBy: volumeUSD
        orderDirection: desc
        skip: $skip
        first: ${limit}
      ) {
        id
        fee: feeTier
        tickSpacing
        token0 {
          address: id
        }
        token1 {
          address: id
        }
        hooks
        tick
        ticks(first: ${ticksLimit}) {
          id
          liquidityGross
          liquidityNet
          tickIdx
        }
      }
    }`;

    const { data } = await this.dexHelper.httpRequest.querySubgraph<{
      data: {
        pools: SubgraphPool[];
      };
    }>(
      this.subgraph,
      {
        query: poolsQuery,
        variables: { skip: skip },
      },
      { timeout: SUBGRAPH_TIMEOUT },
    );

    return data.pools;
  }

  getAvailablePoolsForPair(srcToken: Address, destToken: Address): Pool[] {
    const isEthSrc = isETHAddress(srcToken);
    const isEthDest = isETHAddress(destToken);

    const src = isEthSrc ? NULL_ADDRESS : srcToken.toLowerCase();
    const dest = isEthDest ? NULL_ADDRESS : destToken.toLowerCase();

    const pools = this.pools.filter(
      pool =>
        (pool.key.currency0 === src && pool.key.currency1 === dest) ||
        (pool.key.currency0 === dest && pool.key.currency1 === src),
    );

    return pools;
  }

  async queryPrice(
    zeroForOne: boolean,
    amounts: bigint[],
    pool: Pool,
  ): Promise<bigint[]> {
    const calls = amounts.map(amount => ({
      target: this.quoter,
      callData: this.quoterIface.encodeFunctionData('quoteExactInputSingle', [
        {
          poolKey: pool.key,
          zeroForOne,
          exactAmount: amount.toString(),
          hookData: '0x',
        },
      ]),
      decodeFunction: (result: MultiResult<BytesLike> | BytesLike): bigint => {
        // amountOut, gasEstimate
        return generalDecoder(result, ['uint256', 'uint256'], 0n, value =>
          BigInt(value[0].toString()),
        );
      },
    }));

    const results = await this.dexHelper.multiWrapper!.tryAggregate(
      false,
      calls,
    );
    return results.map(result => (result.success ? result.returnData : 0n));
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: UniswapV4Data,
    side: SwapSide,
  ): DexExchangeParam {
    const exchangeData = swapExactInputSingleCalldata(
      srcToken,
      destToken,
      data.pool.key,
      data.zeroForOne,
      BigInt(srcAmount),
      // destMinAmount (can be 0 on dex level)
      BigInt(0),
      recipient,
    );

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData,
      targetExchange: this.router,
      permit2Approval: true,
      returnAmountPos: undefined,
    };
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV4Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { exchange } = data;

    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }
}
