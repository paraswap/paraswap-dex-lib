import { AsyncOrSync } from 'ts-essentials';
import _, { chain } from 'lodash';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork, isTruthy } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { MaverickV2Data, PoolAPIResponse, SubgraphPoolBase } from './types';
import { SimpleExchange } from '../simple-exchange';
import {
  MaverickV2Config,
  Adapters,
  MAV_V2_BASE_GAS_COST,
  MAV_V2_TICK_GAS_COST,
} from './config';
import { MaverickV2EventPool } from './maverick-v2-pool';
import { SUBGRAPH_TIMEOUT } from '../../constants';
import { Interface } from '@ethersproject/abi';
import MaverickV2PoolABI from '../../abi/maverick-v2/MaverickV2Pool.json';
import ERC20ABI from '../../abi/erc20.json';
const EFFICIENCY_FACTOR = 3;

export class MaverickV2 extends SimpleExchange implements IDex<MaverickV2Data> {
  pools: { [key: string]: MaverickV2EventPool } = {};
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(MaverickV2Config);

  logger: Logger;

  public static erc20Interface = new Interface(ERC20ABI);

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
    protected config = MaverickV2Config[dexKey][network],
    protected maverickV2Iface = new Interface(MaverickV2PoolABI), // TODO: add any additional params required for event subscriber
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
  }

  async initializePricing(blockNumber: number) {
    await this.setupEventPools(blockNumber);
  }

  async setupEventPools(blockNumber: number) {
    const pools = (await this._queryPoolsAPI(SUBGRAPH_TIMEOUT))?.pools;

    await Promise.all(
      pools?.map(async (pool: any) => {
        const eventPool = new MaverickV2EventPool(
          this.dexKey,
          this.network,
          this.dexHelper,
          this.logger,
          {
            address: pool.tokenA.address,
            symbol: pool.tokenA.symbol,
            decimals: pool.tokenA.decimals,
          },
          {
            address: pool.tokenB.address,
            symbol: pool.tokenB.symbol,
            decimals: pool.tokenB.decimals,
          },
          pool.fee * 1e4 * 1e14,
          pool.feeB * 1e4 * 1e14,
          pool.tickSpacing,
          0,
          pool.lookback,
          pool.lowerTick,
          pool.id,
          this.config.poolLensAddress,
        );
        const onChainState = await eventPool.generateState(blockNumber);
        if (blockNumber) {
          eventPool.setState(onChainState, blockNumber);
          this.dexHelper.blockManager.subscribeToLogs(
            eventPool,
            eventPool.addressesSubscribed,
            blockNumber,
          );
        }
        this.pools[eventPool.address] = eventPool;
      }) || [],
    );
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const from = this.dexHelper.config.wrapETH(srcToken);
    const to = this.dexHelper.config.wrapETH(destToken);
    if (from.address.toLowerCase() === to.address.toLowerCase()) {
      return [];
    }

    const pools = await this.getPools(from, to);
    return pools.map(
      (pool: any) => `${this.dexKey}_${pool.address.toLowerCase()}`,
    );
  }

  async getPools(srcToken: Token, destToken: Token) {
    return Object.values(this.pools).filter((pool: MaverickV2EventPool) => {
      return (
        (pool.tokenA.address.toLowerCase() == srcToken.address.toLowerCase() ||
          pool.tokenA.address.toLowerCase() ==
            destToken.address.toLowerCase()) &&
        (pool.tokenB.address.toLowerCase() == srcToken.address.toLowerCase() ||
          pool.tokenB.address.toLowerCase() == destToken.address.toLowerCase())
      );
    });
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<MaverickV2Data>> {
    try {
      const from = this.dexHelper.config.wrapETH(srcToken);
      const to = this.dexHelper.config.wrapETH(destToken);

      if (from.address.toLowerCase() === to.address.toLowerCase()) {
        return null;
      }

      const allPools = await this.getPools(from, to);

      const allowedPools = limitPools
        ? allPools.filter(pool =>
            limitPools.includes(`${this.dexKey}_${pool.address.toLowerCase()}`),
          )
        : allPools;

      if (!allowedPools.length) return null;

      const unitAmount = getBigIntPow(
        side == SwapSide.BUY ? to.decimals : from.decimals,
      );

      return (
        await Promise.all(
          allowedPools.map(async (pool: MaverickV2EventPool) => {
            try {
              let state = pool.getState(blockNumber);
              if (state === null) {
                state = await pool.generateState(blockNumber);
                pool.setState(state, blockNumber);
              }
              if (state === null) {
                this.logger.debug(
                  `Received null state for pool ${pool.address}`,
                );
                return null;
              }

              const [unit] = pool.swap(
                unitAmount,
                from,
                to,
                side == SwapSide.BUY,
              );
              // We stop iterating if it becomes 0n at some point
              let lastOutput = 1n;
              let dataList: [bigint, number][] = await Promise.all(
                amounts.map(amount => {
                  if (amount === 0n) {
                    return [0n, 0];
                  }
                  // We don't want to proceed with calculations if lower amount was not fillable
                  if (lastOutput === 0n) {
                    return [0n, 0];
                  }
                  const output = pool.swap(
                    amount,
                    from,
                    to,
                    side == SwapSide.BUY,
                  );
                  lastOutput = output[0];
                  return output;
                }),
              );

              let prices = dataList.map(d => d[0]);

              let gasCosts: number[] = dataList.map(
                ([d, t]: [BigInt, number]) => {
                  if (d == 0n) return 0;
                  return MAV_V2_BASE_GAS_COST + MAV_V2_TICK_GAS_COST * t;
                },
              );

              return {
                prices: prices,
                unit: BigInt(unit),
                data: {
                  pool: pool.address,
                  tokenA: pool.tokenA.address,
                  tokenB: pool.tokenB.address,
                  activeTick: state.activeTick,
                },
                exchange: this.dexKey,
                poolIdentifier: pool.name,
                gasCost: gasCosts,
                poolAddresses: [pool.address],
              };
            } catch (e) {
              this.logger.debug(
                `Failed to get prices for pool ${pool.address}, from=${from.address}, to=${to.address}`,
                e,
              );
              return null;
            }
          }),
        )
      ).filter(isTruthy);
    } catch (e) {
      this.logger.error(
        `Error_getPricesVolume ${srcToken.symbol || srcToken.address}, ${
          destToken.symbol || destToken.address
        }, ${side}:`,
        e,
      );
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<MaverickV2Data>,
  ): number | number[] {
    const gasCost = CALLDATA_GAS_COST.DEX_NO_PAYLOAD;

    const arr = new Array(poolPrices.prices.length);
    poolPrices.prices.forEach((p, index) => {
      if (p == 0n) {
        arr[index] = 0;
      } else {
        arr[index] = gasCost;
      }
    });
    return arr;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: MaverickV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { pool } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          pool: 'address',
        },
      },
      {
        pool,
      },
    );

    return {
      targetExchange: data.pool,
      payload,
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: MaverickV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { pool } = data;
    const transferData = MaverickV2.erc20Interface.encodeFunctionData(
      'transfer',
      [pool, srcAmount],
    );

    const swapData = this.maverickV2Iface.encodeFunctionData('swap', [
      this.augustusAddress,
      {
        amount: side === SwapSide.SELL ? srcAmount : destAmount,
        tokenAIn: data.tokenA.toLowerCase() === srcToken.toLowerCase(),
        exactOutput: side === SwapSide.BUY,
        tickLimit:
          data.tokenA.toLowerCase() === srcToken.toLowerCase()
            ? data.activeTick + 100n
            : data.activeTick - 100n,
      },
      '0x',
    ]);

    return {
      callees: [srcToken, pool],
      calldata: [transferData, swapData],
      values: ['0', '0'],
      networkFee: '0',
    };
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    return Promise.resolve();
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const _tokenAddress = tokenAddress.toLowerCase();

    const res: PoolAPIResponse | null = await this._queryPoolsAPI(
      SUBGRAPH_TIMEOUT,
    );

    if (!(res && res.pools)) {
      this.logger.error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );
      return [];
    }

    const filteredPools = _.filter(res.pools, pool => {
      return (
        pool.tokenA.address.toLowerCase() === _tokenAddress ||
        pool.tokenB.address.toLowerCase() === _tokenAddress
      );
    });

    const labeledPools = _.map(filteredPools, pool => {
      let token =
        pool.tokenA.address.toLowerCase() === _tokenAddress
          ? pool.tokenB
          : pool.tokenA;

      return {
        exchange: this.dexKey,
        address: pool.id.toLowerCase(),
        connectorTokens: [
          {
            address: token.address.toLowerCase(),
            decimals: token.decimals,
          },
        ],
        liquidityUSD: pool.tvl.amount * EFFICIENCY_FACTOR,
      };
    });

    const pools = _.slice(
      _.sortBy(labeledPools, [pool => -1 * pool.liquidityUSD]),
      0,
      limit,
    );
    return pools;
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }

  private async _queryPoolsAPI(timeout = 30000) {
    try {
      const res = await this.dexHelper.httpRequest.get<PoolAPIResponse>(
        `${this.config.apiURL}/api/v5/poolsNoBins/${this.network}`,
        timeout,
      );
      return res;
    } catch (e) {
      this.logger.error(`${this.dexKey}: can not query subgraph: `, e);
      return null;
    }
  }
}
