import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  ExchangeTxInfo,
  OptimalSwapExchange,
  PreprocessTransactionOptions,
} from '../../types';
import { SwapSide, Network, MAX_INT, MAX_UINT } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getBigIntPow, getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  SwaapV2Data,
  SwaapV2PriceLevel,
  SwaapV2PriceLevels,
  SwaapV2APIParameters,
  SwaapV2QuoteError,
  TokensMap,
  SwaapV2TokensResponse,
} from './types';
import { getLocalDeadlineAsFriendlyPlaceholder, SimpleExchange } from '../simple-exchange';
import { Adapters, SwaapV2Config } from './config';
import { RateFetcher } from './rate-fetcher';
import routerAbi from '../../abi/swaap-v2/vault.json';
import BigNumber from 'bignumber.js';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import { Interface } from 'ethers/lib/utils';
import { assert } from 'ts-essentials';
import {
  SWAAP_RFQ_API_URL,
  SWAAP_RFQ_PRICES_ENDPOINT,
  SWAAP_RFQ_QUOTE_ENDPOINT,
  SWAAP_RFQ_API_PRICES_POLLING_INTERVAL_MS,
  SWAAP_RFQ_PRICES_CACHES_TTL_S,
  GAS_COST_ESTIMATION,
  BATCH_SWAP_SELECTOR,
  CALLER_SLOT,
  SWAAP_BLACKLIST_TTL_S,
  SWAAP_RFQ_TOKENS_ENDPOINT,
  SWAAP_RESTRICT_TTL_S,
  SWAAP_RESTRICTED_CACHE_KEY,
} from './constants';
import {
  getPoolIdentifier,
  getPriceLevelsCacheKey,
  normalizeTokenAddress,
  getPairName,
} from './utils';
import { Method } from '../../dex-helper/irequest-wrapper';
import { validateAndCast } from '../../lib/validators';
import { getTokensResponseValidator } from './validators';
import { SlippageCheckError } from '../generic-rfq/types';
import { BI_MAX_UINT256 } from '../../bigint-constants';

const BLACKLISTED = 'blacklisted';

export class SwaapV2 extends SimpleExchange implements IDex<SwaapV2Data> {
  readonly isStatePollingDex = true;
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;
  readonly isFeeOnTransferSupported = false;
  private rateFetcher: RateFetcher;
  private tokensMap: TokensMap = {};
  private swaapV2AuthToken: string;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(SwaapV2Config);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {},
    protected routerInterface = new Interface(routerAbi),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    const token = dexHelper.config.data.swaapV2AuthToken;
    assert(
      token !== undefined,
      'SwaapV2 auth token is not specified with env variable',
    );

    this.swaapV2AuthToken = token;

    this.rateFetcher = new RateFetcher(
      this.dexHelper,
      this.dexKey,
      this.logger,
      {
        rateConfig: {
          pricesIntervalMs: SWAAP_RFQ_API_PRICES_POLLING_INTERVAL_MS,
          pricesReqParams: this.getPriceLevelsReqParams(),
          pricesCacheTTLSecs: SWAAP_RFQ_PRICES_CACHES_TTL_S,
        },
      },
    );
  }

  async initializePricing(blockNumber: number): Promise<void> {
    const { data } = await this.dexHelper.httpRequest.request<unknown>(
      this.getTokensReqParams(),
    );

    const tokensResp = validateAndCast<SwaapV2TokensResponse>(
      data,
      getTokensResponseValidator,
    );

    this.tokensMap = Object.keys(tokensResp.tokens).reduce((acc, key: string) => {
      acc[key.toLowerCase()] = tokensResp.tokens[key];
      return acc;
    }, {} as TokensMap);

    if (!this.dexHelper.config.isSlave) {
      await this.rateFetcher.start();
    }

    return;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);

    if (normalizedSrcToken.address === normalizedDestToken.address) {
      return [];
    }

    const poolIdentifier = getPoolIdentifier(
      this.dexKey,
      normalizedSrcToken.address,
      normalizedDestToken.address,
    );

    const levels = await this.getCachedLevels();
    if (levels === null) {
      return [];
    }

    return Object.keys(levels)
      .map((pair: string) => {
        return getPoolIdentifier(
          this.dexKey,
          levels[pair].base!,
          levels[pair].quote!,
        );
      })
      .filter((pi: string) => pi === poolIdentifier);
  }

  computePricesFromLevelsBids(
    amounts: BigNumber[],
    asksAndBids: SwaapV2PriceLevels,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
  ): bigint[] {
    let levels: SwaapV2PriceLevel[] = [];
    if (side === SwapSide.BUY) {
      if (destToken.address === asksAndBids.base!) {
        levels = asksAndBids.asks;
      } else {
        levels = this.invertPrices(asksAndBids.bids);
      }
    } else {
      if (srcToken.address === asksAndBids.base!) {
        levels = asksAndBids.bids;
      } else {
        levels = this.invertPrices(asksAndBids.asks);
      }
    }
    return this.computeLevelsQuote(amounts, levels, srcToken, destToken, side);
  }

  inversePrice(priceLevel: SwaapV2PriceLevel): SwaapV2PriceLevel {
    return {
      level: priceLevel.level * priceLevel.price,
      price: 1 / priceLevel.price,
    };
  }

  invertPrices(levels: SwaapV2PriceLevel[]): SwaapV2PriceLevel[] {
    return levels.map(pl => this.inversePrice(pl));
  }

  computeLevelsQuote(
    amounts: BigNumber[],
    levels: SwaapV2PriceLevel[],
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
  ): bigint[] {
    const size = levels.length;
    if (size === 0) {
      return amounts.map(_ => BigInt(0));
    }
    return amounts.map((amount: BigNumber) => {
      if (amount.isZero() || amount.lt(BigNumber(levels[0].level))) {
        return BigInt(0);
      }

      let i = 0;
      let output = BN_0;
      let previousLevel = BN_0;
      let remaininig = BigNumber(amount);
      let enoughLiquidity = false;
      while (i < size) {
        const levelDelta = BigNumber(levels[i].level).minus(previousLevel);
        if (levelDelta.lte(remaininig)) {
          output = output.plus(levelDelta.times(levels[i].price));
          remaininig = remaininig.minus(levelDelta);
          previousLevel = BigNumber(levels[i].level);
          i += 1;
        } else {
          output = output.plus(remaininig.times(levels[i].price));
          enoughLiquidity = true;
          break;
        }
      }
      if (enoughLiquidity) {
        return BigInt(
          output
            .multipliedBy(
              getBigNumberPow(
                side === SwapSide.BUY ? srcToken.decimals : destToken.decimals,
              ),
            )
            .toFixed(0),
        );
      }
      return BigInt(0); // not enough liquidity
    });
  }

  async getCachedLevels(): Promise<Record<string, SwaapV2PriceLevels> | null> {
    const cachedLevels = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      getPriceLevelsCacheKey(this.dexKey),
    );

    if (cachedLevels) {
      return JSON.parse(cachedLevels) as Record<string, SwaapV2PriceLevels>;
    }

    return null;
  }

  normalizeToken(token: Token): Token {
    return {
      address: normalizeTokenAddress(token.address),
      decimals: token.decimals,
    };
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<SwaapV2Data>> {
    try {
      if(await this.isRestricted()) {
        return null;
      }

      const normalizedSrcToken = this.normalizeToken(srcToken);
      const normalizedDestToken = this.normalizeToken(destToken);

      const requestedPoolIdentifier: string = getPoolIdentifier(
        this.dexKey,
        normalizedSrcToken.address,
        normalizedDestToken.address,
      );

      if (normalizedSrcToken.address === normalizedDestToken.address) {
        return null;
      }

      const pools =
        limitPools ??
        (await this.getPoolIdentifiers(srcToken, destToken, side, blockNumber));

      const levels = await this.getCachedLevels();
      if (levels === null) {
        return null;
      }

      const poolIdentifier = getPoolIdentifier(
        this.dexKey,
        normalizedSrcToken.address,
        normalizedDestToken.address,
      );

      const levelEntries: SwaapV2PriceLevels[] = Object.keys(levels)
        .map((pair: string) => {
          if (pools.includes(poolIdentifier)) {
            return levels[pair];
          }
          return undefined;
        })
        .filter((o): o is SwaapV2PriceLevels => o !== undefined);

      const unitVolume = getBigNumberPow(
        (side === SwapSide.SELL ? normalizedSrcToken : normalizedDestToken)
          .decimals,
      );

      const amountsFloat = amounts.map(a =>
        new BigNumber(a.toString()).dividedBy(unitVolume),
      );

      const prices = levelEntries.map((askAndBids: SwaapV2PriceLevels) => {

        const unitPrice = this.computePricesFromLevelsBids(
          [unitVolume],
          askAndBids,
          normalizedSrcToken,
          normalizedDestToken,
          side,
        )[0];
        const prices = this.computePricesFromLevelsBids(
          amountsFloat,
          askAndBids,
          normalizedSrcToken,
          normalizedDestToken,
          side,
        );

        return {
          gasCost: GAS_COST_ESTIMATION,
          exchange: this.dexKey,
          data: {},
          prices,
          unit: unitPrice,
          poolIdentifier: requestedPoolIdentifier,
        } as PoolPrices<SwaapV2Data>;
      });

      return prices;
    } catch (e) {
      this.logger.error(
        `Error_getPrices ${srcToken}, ${destToken}, ${side}:`, e,
      );
      return null;
    }
  }

  getBaseToken(poolIdentifier: string): string {
    return poolIdentifier.split('_')[1];
  }

  getLevels(
    askAndBids: SwaapV2PriceLevels,
    side: SwapSide,
    poolIdentifier: string,
  ) {
    const baseToken: string = this.getBaseToken(poolIdentifier);
    if (side === SwapSide.SELL) {
      return askAndBids.asks;
    }
    return askAndBids.asks;
  }

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<SwaapV2Data>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<SwaapV2Data>, ExchangeTxInfo]> {

    if(await this.isRestricted()) {
      this.logger.warn(
        `${this.dexKey}-${this.network}: protocol is restricted.`,
      );
      throw new Error(
        `${this.dexKey}-${
          this.network
        }: protocol is restricted`,
      );
    }

    if (await this.isBlacklisted(options.txOrigin)) {
      this.logger.warn(
        `${this.dexKey}-${this.network}: blacklisted TX Origin address '${options.txOrigin}' trying to build a transaction. Bailing...`,
      );
      throw new Error(
        `${this.dexKey}-${
          this.network
        }: user=${options.txOrigin.toLowerCase()} is blacklisted`,
      );
    }

    const isSell = side === SwapSide.SELL;

    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);

    const tolerance = (
      options.slippageFactor > BN_1
        ? options.slippageFactor.minus(BN_1)
        : BN_1.minus(options.slippageFactor)
    ).toNumber();

    try {
      const quote = await this.rateFetcher.getQuote(
        this.network,
        normalizedSrcToken,
        normalizedDestToken,
        isSell ? optimalSwapExchange.srcAmount : optimalSwapExchange.destAmount,
        isSell ? 1 : 2,
        options.txOrigin,
        this.augustusAddress,
        tolerance,
        this.getQuoteReqParams(),
      );

      if (!quote.success) {
        const message = `${this.dexKey}-${
          this.network
        }: Failed to fetch RFQ for ${getPairName(
          normalizedSrcToken.address,
          normalizedDestToken.address,
        )}: ${JSON.stringify(quote)}`;
        this.logger.warn(message);
        throw new SwaapV2QuoteError(message);
      } else if (!quote.calldata) {
        const message = `${this.dexKey}-${
          this.network
        }: Failed to fetch RFQ for ${getPairName(
          normalizedSrcToken.address,
          normalizedDestToken.address,
        )}. Missing quote data`;
        this.logger.warn(message);
        throw new SwaapV2QuoteError(message);
      } else if (!quote.router) {
        const message = `${this.dexKey}-${
          this.network
        }: Failed to fetch RFQ for ${getPairName(
          normalizedSrcToken.address,
          normalizedDestToken.address,
        )}. Missing router address`;
        this.logger.warn(message);
        throw new SwaapV2QuoteError(message);
      }

      const srcAmount = BigInt(optimalSwapExchange.srcAmount);
      const destAmount = BigInt(optimalSwapExchange.destAmount);
      const quoteTokenAmount = BigInt(quote.amount);
      const slippageFactor = options.slippageFactor;

      if(side === SwapSide.SELL) {
        if (
          quoteTokenAmount <
          BigInt(
            new BigNumber(destAmount.toString())
              .times(slippageFactor)
              .toFixed(0),
          )
        ) {
          const message = `${this.dexKey}-${this.network}: too much slippage on quote ${side} quoteTokenAmount ${quoteTokenAmount} / destAmount ${destAmount} < ${slippageFactor}`;
          this.logger.warn(message);
          throw new SlippageCheckError(message);
        }
      } else {
        if (
          quoteTokenAmount >
          BigInt(slippageFactor.times(srcAmount.toString()).toFixed(0))
        ) {
          const message = `${this.dexKey}-${
            this.network
          }: too much slippage on quote ${side} baseTokenAmount ${srcAmount} / srcAmount ${srcAmount} > ${slippageFactor.toFixed()}`;
          this.logger.warn(message);
          throw new SlippageCheckError(message);
        }
      }

      return [
        {
          ...optimalSwapExchange,
          data: {
            router: quote.router,
            callData: quote.calldata,
          },
        },
        { deadline: BI_MAX_UINT256 },
      ];
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.endsWith('Request failed with status code 403')
      ) {
        await this.setBlacklist(options.txOrigin);
        this.logger.warn(
          `${this.dexKey}-${this.network}: Encountered restricted user=${options.txOrigin}. Adding to local blacklist cache`,
        );
      } else {
        await this.restrict();
      }

      throw e;
    }
  }

  async restrict(ttl: number = SWAAP_RESTRICT_TTL_S): Promise<boolean> {
    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      SWAAP_RESTRICTED_CACHE_KEY,
      ttl,
      'true',
    );
    return true;
  }

  async isRestricted(): Promise<boolean> {
    const result = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      SWAAP_RESTRICTED_CACHE_KEY,
    );

    return result === 'true';
  }

  async isBlacklisted(txOrigin: Address): Promise<boolean> {
    const result = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.getBlackListKey(txOrigin),
    );
    return result === BLACKLISTED;
  }

  getBlackListKey(address: Address) {
    return `blacklist_${address}`.toLowerCase();
  }

  async setBlacklist(
    txOrigin: Address,
    ttl: number = SWAAP_BLACKLIST_TTL_S,
  ): Promise<boolean> {
    await this.dexHelper.cache.setex(
      this.dexKey,
      this.network,
      this.getBlackListKey(txOrigin),
      ttl,
      BLACKLISTED,
    );
    return true;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<SwaapV2Data>): number | number[] {
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_LARGE +
      // ParentStruct header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[] header
      CALLDATA_GAS_COST.OFFSET_LARGE +
      // ParentStruct -> assets[] header
      CALLDATA_GAS_COST.OFFSET_LARGE +
      // ParentStruct -> funds
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.BOOL +
      CALLDATA_GAS_COST.ADDRESS +
      CALLDATA_GAS_COST.BOOL +
      // ParentStruct -> limits[] header
      CALLDATA_GAS_COST.OFFSET_LARGE +
      // ParentStruct -> deadline
      CALLDATA_GAS_COST.TIMESTAMP +
      // ParentStruct -> swaps[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> swaps[0] header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[0] -> poolId
      CALLDATA_GAS_COST.FULL_WORD +
      // ParentStruct -> swaps[0] -> assetInIndex
      CALLDATA_GAS_COST.INDEX +
      // ParentStruct -> swaps[0] -> assetOutIndex
      CALLDATA_GAS_COST.INDEX +
      // ParentStruct -> swaps[0] -> amount
      CALLDATA_GAS_COST.AMOUNT +
      // ParentStruct -> swaps[0] -> userData header
      CALLDATA_GAS_COST.OFFSET_SMALL +
      // ParentStruct -> swaps[0] -> userData
      CALLDATA_GAS_COST.ZERO +
      // ParentStruct -> assets[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> assets[0:2]
      CALLDATA_GAS_COST.ADDRESS * 2 +
      // ParentStruct -> limits[]
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // ParentStruct -> limits[0:2]
      CALLDATA_GAS_COST.FULL_WORD * 2 +
      // Bool -> IsBatchSwap
      CALLDATA_GAS_COST.BOOL
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SwaapV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { router, callData } = data;

    assert(
      router !== undefined,
      `${this.dexKey}-${this.network}: router undefined`,
    );

    assert(
      callData !== undefined,
      `${this.dexKey}-${this.network}: callData undefined`,
    );

    let payload: string;
    const truncatedCalldata = '0x' + callData.slice(10); // droping the function selector
    const isBatchSwap = callData.slice(0, 10) === BATCH_SWAP_SELECTOR;

    if (isBatchSwap) {
      const batchswapAbi = routerAbi.filter(abi => abi.name === 'batchSwap');

      const callDataStruct = this.abiCoder.decodeParameters(
        batchswapAbi[0].inputs!,
        truncatedCalldata,
      );

      const callerSlots = Array(callDataStruct.swaps.length).fill(160);

      payload = this.abiCoder.encodeParameters(
        [
          'bool',
          'uint256[]',
          {
            ParentStruct: {
              'swaps[]': {
                poolId: 'bytes32',
                assetInIndex: 'uint256',
                assetOutIndex: 'uint256',
                amount: 'uint256',
                userData: 'bytes',
              },
              assets: 'address[]',
              funds: {
                sender: 'address',
                fromInternalBalance: 'bool',
                recipient: 'address',
                toInternalBalance: 'bool',
              },
              limits: 'int256[]',
            },
          },
        ],
        [
          isBatchSwap,
          callerSlots,
          {
            swaps: callDataStruct.swaps,
            assets: callDataStruct.assets,
            funds: callDataStruct.funds,
            limits: callDataStruct.limits.map((_: any) => MAX_INT),
          },
        ],
      );
    } else {
      const swapAbi = routerAbi.filter(abi => abi.name === 'swap');

      const callDataStruct = this.abiCoder.decodeParameters(
        swapAbi[0].inputs!,
        truncatedCalldata,
      );

      const callerSlot = CALLER_SLOT;

      payload = this.abiCoder.encodeParameters(
        [
          'bool',
          'uint256',
          {
            ParentStruct: {
              swap: {
                poolId: 'bytes32',
                kind: 'uint8',
                assetIn: 'address',
                assetOut: 'address',
                amount: 'uint256',
                userData: 'bytes',
              },
              funds: {
                sender: 'address',
                fromInternalBalance: 'bool',
                recipient: 'address',
                toInternalBalance: 'bool',
              },
              limit: 'uint256',
            },
          },
        ],
        [
          isBatchSwap,
          callerSlot,
          {
            swap: {
              poolId: callDataStruct.singleSwap.poolId,
              kind: callDataStruct.singleSwap.kind,
              assetIn: callDataStruct.singleSwap.assetIn,
              assetOut: callDataStruct.singleSwap.assetOut,
              amount: callDataStruct.singleSwap.amount,
              userData: callDataStruct.singleSwap.userData,
            },
            funds: {
              sender: callDataStruct.funds.sender,
              fromInternalBalance: callDataStruct.funds.fromInternalBalance,
              recipient: callDataStruct.funds.recipient,
              toInternalBalance: callDataStruct.funds.toInternalBalance,
            },
            limit: side === SwapSide.BUY ? MAX_UINT : '0',
          },
        ],
      );
    }

    return {
      targetExchange: router,
      payload: payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SwaapV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { router, callData } = data;

    assert(
      router !== undefined,
      `${this.dexKey}-${this.network}: router undefined`,
    );

    assert(
      callData !== undefined,
      `${this.dexKey}-${this.network}: callData undefined`,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      callData,
      router,
    );
  }

  computeMaxLiquidity = (
    levels: SwaapV2PriceLevels,
    tokenAddress: string,
  ): number => {
    if (tokenAddress === levels.base!) {
      return (
        (levels.asks[levels.asks.length - 1]?.level ?? 0) *
        levels.asks[0]?.price
      );
    }
    return (
      (levels.asks[levels.bids.length - 1]?.level ?? 0) * levels.asks[0]?.price
    );
  };

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {

    if(await this.isRestricted()) {
      return [];
    }

    const normalizedTokenAddress = normalizeTokenAddress(tokenAddress);

    const pLevels = await this.getCachedLevels();

    if (pLevels === null) {
      return [];
    }

    return Object.keys(pLevels)
      .filter((pair: string) => {
        return (
          normalizedTokenAddress === pLevels[pair].base ||
          normalizedTokenAddress === pLevels[pair].quote
        );
      })
      .map((pair: string) => {
        return {
          exchange: this.dexKey,
          connectorTokens: [this.getTokenFromAddress(normalizedTokenAddress === pLevels[pair].base ? pLevels[pair].quote : pLevels[pair].base)],
          liquidityUSD: this.computeMaxLiquidity(pLevels[pair], tokenAddress),
        } as PoolLiquidity;
      })
      .sort((pl: PoolLiquidity) => {
        return -pl.liquidityUSD;
      })
      .slice(0, limit);
  }

  getTokenFromAddress(address: Address): Token {
    return this.tokensMap[address];
  }

  releaseResources(): void {
    if (this.rateFetcher) {
      this.rateFetcher.stop();
    }
  }

  getPriceLevelsReqParams(): SwaapV2APIParameters {
    return this.getAPIReqParams(SWAAP_RFQ_PRICES_ENDPOINT, 'GET');
  }

  getQuoteReqParams(): SwaapV2APIParameters {
    return this.getAPIReqParams(SWAAP_RFQ_QUOTE_ENDPOINT, 'POST');
  }

  getTokensReqParams(): SwaapV2APIParameters {
    return this.getAPIReqParams(SWAAP_RFQ_TOKENS_ENDPOINT, 'GET');
  }

  getAPIReqParams(endpoint: string, method: Method): SwaapV2APIParameters {
    return {
      url: `${SWAAP_RFQ_API_URL}/${endpoint}`,
      params: {
        networkId: this.network,
      },
      headers: { 'x-api-key': this.swaapV2AuthToken },
      method: method,
    };
  }
}
