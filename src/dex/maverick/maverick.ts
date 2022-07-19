import { AbiCoder, Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  Log,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  BlockHeader,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { getDexKeysWithNetwork, getBigIntPow } from '../../utils';
import PoolABI from '../../abi/maverick/pool.json';
import RouterABI from '../../abi/maverick/router.json';

import * as _ from 'lodash';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { MaverickData, MaverickPoolState, SubgraphPoolBase } from './types';
import { SimpleExchange } from '../simple-exchange';
import { MaverickConfig, Adapters } from './config';
import { MaverickPool } from './maverick-pool';
import { BI_POWS } from '../../bigint-constants';
import { parseFixed } from '@ethersproject/bignumber';
import { MathSol } from '../balancer-v2/balancer-v2-math';
import { MMath } from './maverick-math';

const subgraphTimeout = 1000 * 10;
const MAX_POOL_CNT = 1000; // Taken from SOR
const POOL_CACHE_TTL = 60 * 60; // 1hr

const fetchAllPools = `
  query($count: Int){
      pools(first: $count, orderBy: balanceUSD, orderDirection: desc) {
          id
          fee
          w
          h
          k
          paramChoice
          twauLookback
          uShiftMultiplier
          maxSpreadFee
          spreadFeeMultiplier
          protocolFeeRatio
          epsilon
          quoteBalance
          baseBalance
          base {
              id
              decimals
              symbol
          }
          quote {
              id
              decimals
              symbol
          }
      }
  }
`;

const fetchPoolsFromTokens = `
  query($count: Int, $from: [String], $to: [String]){
      pools(first: $count, orderBy: balanceUSD, orderDirection: desc, where: {quote_in: $from, base_in: $to}) {
          id
          fee
          w
          h
          k
          paramChoice
          twauLookback
          uShiftMultiplier
          maxSpreadFee
          spreadFeeMultiplier
          protocolFeeRatio
          epsilon
          quoteBalance
          baseBalance
          base {
              id
              decimals
              symbol
          }
          quote {
              id
              decimals
              symbol
          }
      }
  }
`;

const fetchQuoteTokenPools = `
  query($count: Int, $token: [String]){
      pools(first: $count, orderBy: balanceUSD, orderDirection: desc, where: {quote_in: $token}) {
          id
          fee
          w
          h
          k
          paramChoice
          quoteBalance
          baseBalance
          balanceUSD
          base {
              id
              decimals
              symbol
          }
          quote {
              id
              decimals
              symbol
          }
      }
  }
`;

const fetchBaseTokenPools = `
  query($count: Int, $token: [String]){
      pools(first: $count, orderBy: balanceUSD, orderDirection: desc, where: {base_in: $token}) {
          id
          fee
          w
          h
          k
          paramChoice
          quoteBalance
          baseBalance
          balanceUSD
          base {
              id
              decimals
              symbol
          }
          quote {
              id
              decimals
              symbol
          }
      }
  }
`;

const coder = new AbiCoder();

export class MaverickEventPool extends StatefulEventSubscriber<MaverickPoolState> {
  poolDecoder: (log: Log) => any;
  public poolInterface: Interface;
  public pool: MaverickPool;
  addressesSubscribed: string[];

  handlers: {
    [event: string]: (
      event: any,
      pool: MaverickPoolState,
      log: Log,
      blockHeader: BlockHeader,
    ) => MaverickPoolState;
  } = {};

  constructor(
    protected parentName: string,
    protected dexHelper: IDexHelper,
    public address: Address,
    public quote: Token,
    public base: Token,
    public fee: number,
    public w: number,
    public h: number,
    public k: number,
    public paramChoice: number,
    public twauLookback: number,
    public uShiftMultiplier: number,
    public maxSpreadFee: number,
    public spreadFeeMultiplier: number,
    public protocolFeeRatio: number,
    public epsilon: number,
    logger: Logger,
  ) {
    super(
      `${parentName} ${quote.symbol || quote.address}-${
        base.symbol || base.address
      }-${fee}-${w}-${h}`,
      logger,
    );

    this.poolInterface = new Interface(PoolABI);
    this.poolDecoder = (log: Log) => this.poolInterface.parseLog(log);
    this.handlers['Swap'] = this.handleSwap.bind(this);
    this.handlers['AddLiquidity'] = this.handleAddLiquidity.bind(this);
    this.handlers['RemoveLiquidity'] = this.handleRemoveLiquidity.bind(this);
    this.addressesSubscribed = [address];
    this.pool = new MaverickPool(
      parentName,
      parseFixed(epsilon.toString(), 18).toBigInt(),
      parseFixed(fee.toString(), 18).toBigInt(),
      parseFixed(protocolFeeRatio.toString(), 18).toBigInt(),
      parseFixed(spreadFeeMultiplier.toString(), 18).toBigInt(),
      BigInt(twauLookback),
      parseFixed(uShiftMultiplier.toString(), 18).toBigInt(),
      parseFixed(w.toString(), 18).toBigInt(),
      parseFixed(k.toString(), 18).toBigInt(),
      parseFixed(h.toString(), 18).toBigInt(),
    );
  }

  protected processLog(
    state: DeepReadonly<MaverickPoolState>,
    log: Readonly<Log>,
    blockHeader: BlockHeader,
  ): DeepReadonly<MaverickPoolState> | null {
    const event = this.poolDecoder(log);
    if (event.name in this.handlers) {
      return this.handlers[event.name](event, state, log, blockHeader);
    }
    return state;
  }

  handleSwap(
    event: any,
    state: MaverickPoolState,
    log: Log,
    blockHeader: BlockHeader,
  ): MaverickPoolState {
    let amountIn = event.args.amountIn.toBigInt();
    this.pool.swap(
      state,
      BigInt(blockHeader.timestamp),
      amountIn,
      event.args.swapForBase,
    );
    return state;
  }

  handleAddLiquidity(
    event: any,
    state: MaverickPoolState,
    log: Log,
    blockHeader: BlockHeader,
  ): MaverickPoolState {
    state.quoteBalance += event.args.quoteAmount.toBigInt();
    state.baseBalance += event.args.baseAmount.toBigInt();
    if (state.u == 0n) {
      state.u = MMath.div(state.quoteBalance, state.baseBalance);
      state.twau = state.u;
      state.lastTimestamp = BigInt(blockHeader.timestamp);
    }
    return state;
  }

  handleRemoveLiquidity(
    event: any,
    state: MaverickPoolState,
    log: Log,
    blockHeader: BlockHeader,
  ): MaverickPoolState {
    const quoteAmount = event.args.quoteAmount.toBigInt();
    const baseAmount = event.args.baseAmount.toBigInt();
    (state.quoteBalance -= quoteAmount), this.quote;
    (state.baseBalance -= baseAmount), this.base;
    return state;
  }

  scaleFromAmount(amount: bigint, token: Token) {
    if (token.decimals > 18) {
      const scalingFactor: bigint =
        BI_POWS[18] * getBigIntPow(token.decimals - 18);
      return MathSol.divDownFixed(amount, scalingFactor);
    } else {
      const scalingFactor: bigint =
        BI_POWS[18] * getBigIntPow(18 - token.decimals);
      return MathSol.mulUpFixed(amount, scalingFactor);
    }
  }

  scaleToAmount(amount: bigint, token: Token) {
    if (token.decimals > 18) {
      const scalingFactor: bigint =
        BI_POWS[18] * getBigIntPow(token.decimals - 18);
      return MathSol.mulUpFixed(amount, scalingFactor);
    } else {
      const scalingFactor: bigint =
        BI_POWS[18] * getBigIntPow(18 - token.decimals);
      return MathSol.divDownFixed(amount, scalingFactor);
    }
  }

  swap(amount: bigint, from: Token, to: Token) {
    const scaledAmount = this.scaleFromAmount(amount, from);
    const output = this.pool.swap(
      { ...this.state! },
      0n,
      scaledAmount,
      from.address.toLowerCase() == this.quote.address.toLowerCase(),
    );
    return this.scaleToAmount(output, to);
  }

  async generateState(
    blockNumber: number | 'latest' = 'latest',
  ): Promise<DeepReadonly<MaverickPoolState>> {
    let calldata = [
      {
        target: this.address,
        callData: this.poolInterface.encodeFunctionData('quoteBalance', []),
      },
      {
        target: this.address,
        callData: this.poolInterface.encodeFunctionData('baseBalance', []),
      },
      {
        target: this.address,
        callData: this.poolInterface.encodeFunctionData('u', []),
      },
      {
        target: this.address,
        callData: this.poolInterface.encodeFunctionData(
          'getTwapParameters',
          [],
        ),
      },
    ];

    const data = await this.dexHelper.multiContract.methods
      .aggregate(calldata)
      .call({}, blockNumber);

    return {
      quoteBalance: coder.decode(['int128'], data.returnData[0])[0].toBigInt(),
      baseBalance: coder.decode(['int128'], data.returnData[1])[0].toBigInt(),
      u: coder.decode(['int256'], data.returnData[2])[0].toBigInt(),
      lastTimestamp: BigInt(
        coder.decode(['int32', 'int224'], data.returnData[3])[0],
      ),
      twau: coder.decode(['int32', 'int224'], data.returnData[3])[1].toBigInt(),
    };
  }
}

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
    protected subgraphURL: string = MaverickConfig[dexKey][network].subgraphURL, // TODO: add any additional optional params to support other fork DEXes
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
      subgraphTimeout,
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
      subgraphTimeout,
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
      subgraphTimeout,
    );
    const data2 = await this.dexHelper.httpRequest.post(
      this.subgraphURL,
      {
        query: fetchBaseTokenPools,
        variables: { count, token: [token.address.toLowerCase()] },
      },
      subgraphTimeout,
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
