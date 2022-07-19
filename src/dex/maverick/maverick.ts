import _ from 'lodash';
import { Interface } from '@ethersproject/abi';
import {
  Token,
  ExchangePrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import {
  SwapSide,
  Network,
  SUBGRAPH_TIMEOUT,
  MAX_POOL_CNT,
} from '../../constants';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import PoolABI from '../../abi/maverick/pool.json';
import RouterABI from '../../abi/maverick/router.json';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { MaverickData, SubgraphPoolBase } from './types';
import { SimpleExchange } from '../simple-exchange';
import { MaverickConfig, Adapters } from './config';
import { MaverickEventPool } from './maverick-pool';
import {
  fetchAllPools,
  fetchBaseTokenPools,
  fetchPoolsFromTokens,
  fetchQuoteTokenPools,
} from './subgraph-queries';

export class Maverick extends SimpleExchange implements IDex<MaverickData> {
  pools: { [key: string]: MaverickEventPool } = {};
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;

  exchangeRouterInterface: Interface;
  poolInterface: Interface;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(MaverickConfig);

  logger: Logger;

  constructor(
    protected network: Network,
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    protected adapters = Adapters[network],
    protected subgraphURL: string = MaverickConfig[dexKey][network].subgraphURL,
  ) {
    super(dexHelper.config.data.augustusAddress, dexHelper.web3Provider);
    this.logger = dexHelper.getLogger(dexKey);
    this.exchangeRouterInterface = new Interface(RouterABI);
    this.poolInterface = new Interface(PoolABI);
  }

  async fetchAllSubgraphPools(): Promise<SubgraphPoolBase[]> {
    this.logger.info(
      `Fetching ${this.dexKey}_${this.network} Pools from subgraph`,
    );
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      { query: fetchAllPools, count: MAX_POOL_CNT },
      SUBGRAPH_TIMEOUT,
    );
    return data.pools;
  }

  async fetchSubgraphPoolsFromTokens(
    from: Token,
    to: Token,
  ): Promise<SubgraphPoolBase[]> {
    this.logger.info(
      `Fetching ${this.dexKey}_${this.network} Pools from subgraph`,
    );
    const { data } = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      { query: fetchPoolsFromTokens, count: MAX_POOL_CNT },
      SUBGRAPH_TIMEOUT,
    );
    return data.pools;
  }

  async setupEventPools(blockNumber: number) {
    const pools = await this.fetchAllSubgraphPools();
    await Promise.all(
      pools.map(async (pool: any) => {
        const eventPool = new MaverickEventPool(
          this.dexKey,
          this.dexHelper,
          pool.id,
          {
            address: pool.quote.id,
            symbol: pool.quote.symbol,
            decimals: pool.quote.decimals,
          },
          {
            address: pool.base.id,
            symbol: pool.base.symbol,
            decimals: pool.base.decimals,
          },
          pool.fee,
          pool.w,
          pool.h,
          pool.k,
          pool.paramChoice,
          pool.twauLookback,
          pool.uShiftMultiplier,
          pool.maxSpreadFee,
          pool.spreadFeeMultiplier,
          pool.protocolFeeRatio,
          pool.epsilon,
          this.logger,
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

        this.pools[eventPool.name] = eventPool;
      }),
    );
  }

  async initializePricing(blockNumber: number) {
    await this.setupEventPools(blockNumber);
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const from = this.dexHelper.config.wrapETH(srcToken);
    const to = this.dexHelper.config.wrapETH(destToken);
    const pools = await this.getPools(from, to);
    return pools.map(
      (pool: any) => `${this.dexKey}_${pool.address.toLowerCase()}`,
    );
  }

  async getPools(srcToken: Token, destToken: Token) {
    return Object.values(this.pools).filter((pool: MaverickEventPool) => {
      return (
        (pool.quote.address.toLowerCase() == srcToken.address.toLowerCase() ||
          pool.quote.address.toLowerCase() ==
            destToken.address.toLowerCase()) &&
        (pool.base.address.toLowerCase() == srcToken.address.toLowerCase() ||
          pool.base.address.toLowerCase() == destToken.address.toLowerCase())
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
  ): Promise<null | ExchangePrices<MaverickData>> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const from = this.dexHelper.config.wrapETH(srcToken);
    const to = this.dexHelper.config.wrapETH(destToken);
    const allPools = await this.getPools(from, to);

    const allowedPools = limitPools
      ? allPools.filter((pool: any) =>
          limitPools.includes(`${this.dexKey}_${pool.address.toLowerCase()}`),
        )
      : allPools;
    if (!allowedPools.length) return null;

    const unitAmount = getBigIntPow(from.decimals);

    return Promise.all(
      allowedPools.map(async (pool: MaverickEventPool) => {
        const unit = pool.swap(unitAmount, from, to);
        const prices = await Promise.all(
          amounts.map(amount => pool.swap(amount, from, to)),
        );
        return {
          prices: prices,
          unit: BigInt(unit),
          data: {
            w: pool.w,
            h: pool.h,
            k: pool.k,
            fee: pool.fee,
            paramChoice: pool.paramChoice,
            router: MaverickConfig[this.dexKey][this.network].routerAddress,
            pool: pool.address,
            quote: pool.quote.address,
            base: pool.base.address,
          },
          exchange: this.dexKey,
          poolIdentifier: pool.name,
          gasCost: 200 * 1000,
          poolAddresses: [pool.address],
        };
      }),
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: MaverickData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: data.router,
      payload: '0x',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: MaverickData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);
    return {
      callees: [srcToken, data.pool],
      calldata: [
        this.erc20Interface.encodeFunctionData('transfer', [
          data.pool,
          srcAmount,
        ]),
        this.poolInterface.encodeFunctionData('swap', [
          this.augustusAddress,
          srcToken.toLowerCase() == data.quote.toLowerCase(),
        ]),
      ],
      values: ['0', '0'],
      networkFee: '0',
    };
  }

  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  async getTopPoolsForToken(
    tokenAddress: string,
    count: number,
  ): Promise<PoolLiquidity[]> {
    if (!this.subgraphURL) return [];
    const token = this.dexHelper.config.wrapETH({
      address: tokenAddress,
      decimals: 0,
    });
    const data1 = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      {
        query: fetchQuoteTokenPools,
        variables: { count, token: [token.address.toLowerCase()] },
      },
      SUBGRAPH_TIMEOUT,
    );
    const data2 = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      {
        query: fetchBaseTokenPools,
        variables: { count, token: [token.address.toLowerCase()] },
      },
      SUBGRAPH_TIMEOUT,
    );
    const data = { pools: [...data1.data.pools, ...data2.data.pools] };
    if (!(data && data.pools))
      throw new Error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );
    const pools = _.map(data.pools, pool => ({
      exchange: this.dexKey,
      address: pool.id.toLowerCase(),
      connectorTokens: [pool.quote, pool.base].reduce(
        (acc, { decimals, id }) => {
          if (id.toLowerCase() != tokenAddress.toLowerCase())
            acc.push({
              decimals: parseInt(decimals),
              address: id.toLowerCase(),
            });
          return acc;
        },
        [],
      ),
      liquidityUSD: parseFloat(pool.balanceUSD),
    }));

    return _.slice(_.sortBy(pools, [pool => -1 * pool.liquidityUSD]), 0, count);
  }
}
