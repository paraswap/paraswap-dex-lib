import { Interface } from '@ethersproject/abi';
import { BytesLike } from 'ethers/lib/ethers';
import _ from 'lodash';
import { AsyncOrSync, DeepReadonly, assert } from 'ts-essentials';
import D3ProxyABI from '../../abi/dodo-v3/D3Proxy.abi.json';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { Network, SUBGRAPH_TIMEOUT, SwapSide } from '../../constants';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { IDex } from '../../dex/idex';
import { generalDecoder } from '../../lib/decoders';
import { MultiCallParams, MultiResult } from '../../lib/multi-wrapper';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  ExchangeTxInfo,
  Logger,
  OptimalSwapExchange,
  PoolLiquidity,
  PoolPrices,
  PreprocessTransactionOptions,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import {
  SimpleExchange,
  getLocalDeadlineAsFriendlyPlaceholder,
} from '../simple-exchange';
import {
  Adapters,
  DodoV3Config,
  POOL_CACHE_TTL,
  SUBGRAPH_FETCH_ALL_POOOLS_RQ,
  SUBGRAPH_FETCH_TOP_POOOLS_RQ,
} from './config';
import { DodoV3EventPool } from './dodo-v3-pool';
import { DodoV3Vault, OnPoolCreatedOrRemovedCallback } from './dodo-v3-vault';
import {
  D3ProxyFunctions,
  D3ProxySwapTokensParams,
  DexParams,
  DodoV3Data,
  PoolState,
  QuerySellOrBuyTokensResult,
} from './types';

function querySellOrBuyTokensResultDecoder(
  result: MultiResult<BytesLike> | BytesLike,
): QuerySellOrBuyTokensResult {
  return generalDecoder(
    result,
    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
    undefined,
    value => ({
      payFromAmount: value[0].toBigInt(),
      receiveToAmount: value[1].toBigInt(),
      vusdAmount: value[2].toBigInt(),
      swapFee: value[3].toBigInt(),
      mtFee: value[4].toBigInt(),
    }),
  );
}

export class DodoV3 extends SimpleExchange implements IDex<DodoV3Data> {
  protected config: DexParams;

  private readonly D3Vault: DodoV3Vault;

  readonly eventPools: Record<string, DodoV3EventPool> = {};

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = true;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(_.pick(DodoV3Config, ['DodoV3']));

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    readonly proxyIface = new Interface(D3ProxyABI),
  ) {
    super(dexHelper, dexKey);
    this.config = DodoV3Config[dexKey][network];
    this.logger = dexHelper.getLogger(dexKey);

    this.D3Vault = new DodoV3Vault(
      dexHelper,
      dexKey,
      this.config.D3Vault,
      this.logger,
      this.onPoolCreated,
      this.onPoolRemoved,
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // Init listening to new pools creation
    await this.D3Vault.initialize(blockNumber);

    const allPools = await this.fetchAllSubgraphPools(blockNumber);
    for (const pool of allPools) {
      await this.addPool(pool.id, blockNumber);
    }
  }

  async addPool(newD3Address: string, blockNumber: number) {
    const pool = new DodoV3EventPool(
      this.dexKey,
      this.network,
      this.dexHelper,
      this.logger,
      newD3Address,
    );

    await pool.initialize(blockNumber);
    this.eventPools[this.getPoolIdentifier(newD3Address)] = pool;
  }

  onPoolCreated: OnPoolCreatedOrRemovedCallback = async ({
    pool,
    blockNumber,
  }) => {
    this.logger.info(
      `[onPoolCreated] ${this.dexKey}_${this.network} key=${pool}`,
    );
    await this.addPool(pool, blockNumber);
  };

  onPoolRemoved: OnPoolCreatedOrRemovedCallback = async ({
    pool,
    blockNumber,
  }) => {
    this.logger.info(
      `[onPoolRemoved] ${this.dexKey}_${this.network} key=${pool}`,
    );
    const poolIdentifier = this.getPoolIdentifier(pool);
    const eventPool = this.eventPools[poolIdentifier];
    if (eventPool) {
      eventPool.invalidate();
      delete this.eventPools[poolIdentifier];
    }
  };

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  protected getPoolIdentifier(poolAddress: Address): string {
    return `${this.dexKey}_${poolAddress.toLowerCase()}`;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    if (!this.eventPools) {
      return [];
    }

    const srcTokenAddress = srcToken.address.toLowerCase();
    const destTokenAddress = destToken.address.toLowerCase();

    return Object.keys(this.eventPools).filter(poolIdentifier => {
      const pool = this.eventPools[poolIdentifier];
      const state = pool.getState(blockNumber);
      if (state) {
        const { depositedTokenList } = state;

        // Even if the fromToken or toToken is in the vault, it is still not possible to inquire or swap without setting a new token for the pool. Therefore, both fromToken and toToken must be in the pool in order to use this pool for inquiry without causing an error.
        return (
          depositedTokenList.includes(destTokenAddress) &&
          depositedTokenList.includes(srcTokenAddress)
        );
      }
      return false;
    });
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<DodoV3Data>> {
    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    const _srcAddress = _srcToken.address.toLowerCase();
    const _destAddress = _destToken.address.toLowerCase();

    let selectedPools: DodoV3EventPool[] = [];
    if (limitPools) {
      selectedPools = limitPools.map(
        poolIdentifier => this.eventPools[poolIdentifier],
      );
    } else {
      selectedPools = (
        await this.getPoolIdentifiers(srcToken, destToken, side, blockNumber)
      ).map(poolIdentifier => this.eventPools[poolIdentifier]);
    }

    if (selectedPools.length === 0) {
      return null;
    }

    const calls: MultiCallParams<any>[] = [];

    const unitVolume = getBigIntPow(
      (side === SwapSide.SELL ? _srcToken : _destToken).decimals,
    );

    const generateCall = (
      state: DeepReadonly<PoolState>,
      pool: DodoV3EventPool,
      amount: bigint,
    ) => {
      return {
        target: state.D3MMAddress,
        callData: pool.D3MMIface.encodeFunctionData(
          side === SwapSide.BUY ? 'queryBuyTokens' : 'querySellTokens',
          [_srcAddress, _destAddress, amount.toString()],
        ),
        decodeFunction: querySellOrBuyTokensResultDecoder,
      };
    };

    selectedPools.forEach(pool => {
      const state = pool.getState(blockNumber);
      if (!state) {
        return;
      }
      calls.push(generateCall(state, pool, unitVolume));
      amounts.forEach(amount => {
        if (amount <= 1000) {
          return;
        }
        calls.push(generateCall(state, pool, amount));
      });
    });
    if (calls.length < 0) {
      return null;
    }
    const resQuerySwapTokens =
      await this.dexHelper.multiWrapper.tryAggregate<QuerySellOrBuyTokensResult>(
        false,
        calls,
        blockNumber,
        this.dexHelper.multiWrapper.defaultBatchSize,
        true,
      );

    const result: ExchangePrices<DodoV3Data> = [];
    let i = 0;
    selectedPools.forEach(pool => {
      const state = pool.getState(blockNumber);
      if (!state) {
        return;
      }

      const unitRes = resQuerySwapTokens[i++];
      const unit = unitRes.success
        ? side === SwapSide.BUY
          ? unitRes.returnData.payFromAmount
          : unitRes.returnData.receiveToAmount
        : 0n;

      const prices: bigint[] = [];
      amounts.forEach(amount => {
        if (amount <= 1000) {
          prices.push(0n);
          return;
        }
        const amountRes = resQuerySwapTokens[i++];
        prices.push(
          amountRes.success
            ? side === SwapSide.BUY
              ? amountRes.returnData.payFromAmount
              : amountRes.returnData.receiveToAmount
            : 0n,
        );
      });
      result.push({
        prices,
        unit,
        data: {
          exchange: state.D3MMAddress,
        },
        poolIdentifier: this.getPoolIdentifier(state.D3MMAddress),
        exchange: this.dexKey,
        gasCost: CALLDATA_GAS_COST.DEX_NO_PAYLOAD,
        poolAddresses: [state.D3MMAddress],
      });
    });

    if (result.length === 0) {
      return null;
    }

    return result;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<DodoV3Data>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: DodoV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    // TODO: complete me!
    const { exchange } = data;

    // Encode here the payload for adapter
    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }

  getTokenFromAddress(address: Address): Token {
    // In this Dex decimals are not used
    return { address, decimals: 0 };
  }

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<DodoV3Data>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<DodoV3Data>, ExchangeTxInfo]> {
    assert(
      optimalSwapExchange.data !== undefined,
      `preProcessTransaction: data field is missing`,
    );

    return [
      {
        ...optimalSwapExchange,
        data: {
          ...optimalSwapExchange.data,
          slippageFactor: options.slippageFactor,
        },
      },
      { deadline: BigInt(getLocalDeadlineAsFriendlyPlaceholder()) },
    ];
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
    data: DodoV3Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { exchange, slippageFactor } = data;

    assert(
      slippageFactor !== undefined,
      `${this.dexKey}-${this.network}: slippageFactor undefined`,
    );

    const isSell = side === SwapSide.SELL;
    const swapFunction = isSell
      ? D3ProxyFunctions.sellTokens
      : D3ProxyFunctions.buyTokens;
    const minReceiveAmount = slippageFactor.times(destAmount).toFixed(0);
    const maxPayAmount = slippageFactor.times(srcAmount).toFixed(0);
    const d3MMSwapCallBackData = this.abiCoder.encodeParameters([], []);
    const swapFunctionParams: D3ProxySwapTokensParams = isSell
      ? [
          exchange,
          this.augustusAddress,
          srcToken,
          destToken,
          srcAmount,
          minReceiveAmount,
          d3MMSwapCallBackData,
          getLocalDeadlineAsFriendlyPlaceholder(),
        ]
      : [
          exchange,
          this.augustusAddress,
          srcToken,
          destToken,
          destAmount,
          maxPayAmount,
          d3MMSwapCallBackData,
          getLocalDeadlineAsFriendlyPlaceholder(),
        ];
    const swapData = this.proxyIface.encodeFunctionData(swapFunction, [
      ...swapFunctionParams,
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.config.D3Proxy,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {}

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const _tokenAddress = tokenAddress.toLowerCase();

    const data = await this._querySubgraph<{
      pools: Array<{
        id: string;
        totalAssetsUSD: string;
        tokenList: Array<{
          token: {
            id: string;
            decimals: string;
            symbol: string;
          };
        }>;
      }> | null;
    } | null>(SUBGRAPH_FETCH_TOP_POOOLS_RQ, {
      where: {
        isRemove: false,
        vault: this.config.D3Vault.toLowerCase(),
        tokenList_: {
          token: _tokenAddress,
        },
        totalAssetsUSD_gt: 0,
      },
      first: limit,
    });

    if (!data || !data.pools) {
      this.logger.error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );
      return [];
    }
    return data.pools
      .map(pool => {
        return {
          exchange: this.dexKey,
          address: pool.id.toLowerCase(),
          connectorTokens: pool.tokenList
            .map(t => t.token)
            .filter(t => t.id.toLowerCase() !== _tokenAddress)
            .map(t => {
              return {
                address: t.id.toLowerCase(),
                decimals: parseInt(t.decimals),
                symbol: t.symbol,
              };
            }),
          liquidityUSD: parseFloat(pool.totalAssetsUSD),
        };
      })
      .slice(0, limit);
  }

  async fetchAllSubgraphPools(blockNumber: number): Promise<
    Array<{
      id: string;
    }>
  > {
    const cacheKey = 'AllSubgraphPools';
    const cachedPools = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      cacheKey,
    );
    if (cachedPools) {
      const allPools = JSON.parse(cachedPools);
      this.logger.info(
        `Got ${allPools.length} ${this.dexKey}_${this.network} pools from cache`,
      );
      return allPools;
    }

    this.logger.info(
      `Fetching ${this.dexKey}_${this.network} Pools from subgraph`,
    );
    const variables = {
      where: {
        isRemove: false,
        vault: this.config.D3Vault.toLowerCase(),
      },
      first: 1000,
    };
    const data = await this._querySubgraph<{
      pools: Array<{
        id: string;
      }> | null;
    } | null>(SUBGRAPH_FETCH_ALL_POOOLS_RQ, variables);
    if (!data || !data.pools) {
      this.logger.error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );
      return [];
    }

    this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      cacheKey,
      POOL_CACHE_TTL,
      JSON.stringify(data.pools),
    );

    this.logger.info(
      `Got ${data.pools.length} ${this.dexKey}_${this.network} pools from subgraph`,
    );

    return data.pools;
  }

  private async _querySubgraph<K>(query: string, variables: Object) {
    try {
      const res = await this.dexHelper.httpRequest.post<{
        data: K;
      }>(this.config.subgraphURL, { query, variables }, SUBGRAPH_TIMEOUT);
      return res.data;
    } catch (e) {
      this.logger.error(`${this.dexKey}: can not query subgraph: `, e);
      return null;
    }
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {}
}
