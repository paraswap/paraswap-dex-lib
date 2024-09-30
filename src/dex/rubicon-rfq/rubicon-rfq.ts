import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Logger,
  Address,
  PoolPrices,
  PoolLiquidity,
  ExchangeTxInfo,
  ExchangePrices,
  NumberAsString,
  DexExchangeParam,
  OptimalSwapExchange,
  SimpleExchangeParam,
  AdapterExchangeParam,
  PreprocessTransactionOptions,
} from '../../types';
import {
  SlippageCheckError,
  TooStrictSlippageCheckError,
} from '../generic-rfq/types';
import { SwapSide, Network, CACHE_PREFIX } from '../../constants';
import { assert } from 'ts-essentials';
import {
  MARKET_SPLIT,
  RUBICON_RFQ_API_URL,
  RUBICON_RFQ_GAS_COST,
  RUBICON_RFQ_CLIENT_TAG,
  RUBICON_RFQ_PARTIAL_FILL,
  RUBICON_RFQ_LIQ_ENDPOINT,
  RUBICON_RFQ_LIQ_CACHE_TTL_S,
  RUBICON_RFQ_MARKETS_ENDPOINT,
  RUBICON_RFQ_MARKETS_CACHE_TTL_S,
  RUBICON_RFQ_LIQ_POLL_INTERVAL_MS,
  RUBICON_RFQ_MARKET_MATCH_ENDPOINT,
  RUBICON_RFQ_MARKET_MATCH_TIMEOUT_MS,
  RUBICON_RFQ_MARKETS_POLL_INTERVAL_MS,
  RUBICON_RFQ_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION,
} from './constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { BI_MAX_UINT256 } from '../../bigint-constants';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import BigNumber from 'bignumber.js';
import rubiconRfqABI from '../../abi/rubicon-rfq/rubicon-rfq.abi.json';
import { Interface } from 'ethers/lib/utils';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  Quote,
  RfqError,
  PriceLevel,
  RubiconRfqData,
  RubiconRfqMatchResponse,
  RubiconRfqMarketsResponse,
  RubiconRfqLiquidityResponse,
} from './types';
import { SimpleExchange } from '../simple-exchange';
import { RubiconRfqConfig } from './config';
import { RateFetcher } from './rate-fetcher';
import { SpecialDex } from '../../executor/types';

export class RubiconRfq extends SimpleExchange implements IDex<RubiconRfqData> {
  readonly isStatePollingDex = true;
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;
  readonly needsSequentialPreprocessing = false;
  readonly isFeeOnTransferSupported = false;

  private rateFetcher: RateFetcher;
  private rubiconRfqAuthToken: string;

  private marketsCacheKey: string;
  private liquidityCacheKey: string;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(RubiconRfqConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    readonly rfqAddress: string = RubiconRfqConfig['RubiconRfq'][network]
      .rfqAddress,
    protected rubiconRfqInterface = new Interface(rubiconRfqABI),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);

    const authToken = dexHelper.config.data.rubiconRfqAuthToken;
    assert(
      authToken !== undefined,
      'RubiconRFQ auth token is not specified with env variable',
    );

    this.rubiconRfqAuthToken = authToken;

    this.marketsCacheKey = `${CACHE_PREFIX}_${this.dexHelper.config.data.network}_${this.dexKey}_markets`;
    this.liquidityCacheKey = `${CACHE_PREFIX}_${this.dexHelper.config.data.network}_${this.dexKey}_liquidity`;

    this.rateFetcher = new RateFetcher(
      this.dexHelper,
      this.dexKey,
      this.network,
      this.logger,
      {
        rateConfig: {
          marketsIntervalMs: RUBICON_RFQ_MARKETS_POLL_INTERVAL_MS,
          liquidityIntervalMs: RUBICON_RFQ_LIQ_POLL_INTERVAL_MS,
          marketsReqParams: {
            url: `${RUBICON_RFQ_API_URL}${RUBICON_RFQ_MARKETS_ENDPOINT}`,
            params: {
              tag: RUBICON_RFQ_CLIENT_TAG,
              chainId: this.network,
            },
            headers: { 'x-api-key': this.rubiconRfqAuthToken },
          },
          liquidityReqParams: {
            url: `${RUBICON_RFQ_API_URL}${RUBICON_RFQ_LIQ_ENDPOINT}`,
            params: {
              tag: RUBICON_RFQ_CLIENT_TAG,
              chainId: this.network,
            },
            headers: { 'x-api-key': this.rubiconRfqAuthToken },
          },
          marketsCacheKey: this.marketsCacheKey,
          marketsCacheTTLSecs: RUBICON_RFQ_MARKETS_CACHE_TTL_S,
          liquidityCacheKey: this.liquidityCacheKey,
          liquidityCacheTTLSecs: RUBICON_RFQ_LIQ_CACHE_TTL_S,
        },
      },
    );
  }

  async initializePricing(blockNumber: number): Promise<void> {
    if (!this.dexHelper.config.isSlave) {
      this.rateFetcher.start();
    }

    return;
  }

  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  getPoolIdentifier(marketId: string) {
    return `${this.dexKey}_${marketId.toLowerCase()}`;
  }

  pairToMarketId(srcToken: Token, destToken: Token) {
    return (srcToken.address + MARKET_SPLIT + destToken.address).toLowerCase();
  }

  marketIdToPair(marketId: string) {
    return marketId.split(MARKET_SPLIT);
  }

  getTokenFromAddress?(address: Address): Token {
    return { address, decimals: 0 };
  }

  extractQuoteToken(marketId: string, tokenAddress: Address): Token {
    const pair = this.marketIdToPair(marketId);
    // We don't store decimals and symbols, so idk if it's
    // acceptable to return tokens without those fields.
    return pair[0] === tokenAddress
      ? { address: pair[1], decimals: 0, symbol: '' }
      : { address: pair[0], decimals: 0, symbol: '' };
  }

  isOppositeMarket(
    srcToken: Token,
    destToken: Token,
    marketId: string,
  ): boolean {
    if (this.pairToMarketId(destToken, srcToken) === marketId) {
      return true;
    }
    return false;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const markets = (await this.getCachedMarkets()) || {};

    // It may return (src/dest)-priced market
    // and (dest/src)-priced market.
    return Object.keys(markets)
      .filter(
        marketId =>
          marketId === this.pairToMarketId(srcToken, destToken) ||
          marketId === this.pairToMarketId(destToken, srcToken),
      )
      .map(marketId => this.getPoolIdentifier(marketId));
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<RubiconRfqData>> {
    try {
      const pools =
        limitPools ??
        (await this.getPoolIdentifiers(srcToken, destToken, side, blockNumber));

      const marketIdsToUse = pools.map(p => p.split(`${this.dexKey}_`).pop());
      const markets = (await this.getCachedMarkets()) || {};

      const prices = marketIdsToUse.map(id => {
        if (!id) return null;

        const market = markets[id];
        if (!market) return null;

        const levelsMap: string[][] =
          side === SwapSide.SELL ? market.bids : market.asks;

        const div0 = getBigNumberPow(
          side === SwapSide.SELL ? srcToken.decimals : destToken.decimals,
        );
        const div1 = getBigNumberPow(
          side === SwapSide.SELL ? destToken.decimals : srcToken.decimals,
        );

        const amountsRaw = amounts.map(a =>
          new BigNumber(a.toString()).dividedBy(div0),
        );

        const isOpposite =
          side === SwapSide.SELL
            ? this.isOppositeMarket(srcToken, destToken, id)
            : this.isOppositeMarket(destToken, srcToken, id);

        // Inverts market's prices for an opposite market id.
        const levels: PriceLevel[] = levelsMap.map(([price, quantity]) => ({
          price: !isOpposite
            ? new BigNumber(price)
            : BN_1.dividedBy(new BigNumber(price)),
          quantity: !isOpposite
            ? new BigNumber(quantity)
            : new BigNumber(quantity).multipliedBy(new BigNumber(price)),
        }));

        if (levels.length === 0) return null;

        const prices = this.match(amountsRaw, levels, div1, false);
        const unit = this.match([BN_1], levels, div1, true)[0];

        if (!prices) return null;

        return {
          gasCost: RUBICON_RFQ_GAS_COST,
          exchange: this.dexKey,
          data: {},
          prices: prices,
          unit: unit,
          poolIdentifier: this.getPoolIdentifier(id),
          poolAddresses: [this.rfqAddress],
        } as PoolPrices<RubiconRfqData>;
      });
      return prices.filter((p): p is PoolPrices<RubiconRfqData> => !!p);
    } catch (e: unknown) {
      this.logger.error(
        `Error_getPricesVolume ${srcToken.symbol || srcToken.address}, ${
          destToken.symbol || destToken.address
        }, ${side}:`,
        e,
      );
      return null;
    }
  }

  match(
    amounts: BigNumber[],
    levels: PriceLevel[],
    div: BigNumber,
    unit: boolean,
  ): bigint[] {
    const outputs = new Array(amounts.length).fill(BN_0);

    // For a price computation.
    if (unit) {
      levels.unshift({ price: levels[0].price, quantity: BN_1 });
    }

    // Calculate fill for each amount.
    for (let i = 0; i < amounts.length; i++) {
      let amt = amounts[i];

      for (let j = 0; j < levels.length; j++) {
        let levelQty: BigNumber = levels[j].quantity;
        const levelPrice: BigNumber = levels[j].price;

        const fill = BigNumber.minimum(amt, levelQty);

        outputs[i] = outputs[i].plus(fill.multipliedBy(levelPrice));

        amt = amt.minus(fill);
        levelQty = levelQty.minus(fill);

        if (amt.isZero() || !levelQty.isZero()) break;
      }
      // Amount wasn't filled fully.
      //if (!amt.isZero()) outputs[i] = BN_0;
    }

    return outputs.map(o => BigInt(o.multipliedBy(div).toFixed(0)));
  }

  getCalldataGasCost(
    poolPrices: PoolPrices<RubiconRfqData>,
  ): number | number[] {
    // Size of dynamic data to use will be known
    // only after a request to '/*match' endpoints.
    // Thus this approximation assumes that the quote
    // will be matched against 1 order :/
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.OFFSET_SMALL * 7 +
      // All large offsets to tails of dynamic types + nonce.
      CALLDATA_GAS_COST.OFFSET_LARGE * 15 +
      // addresses: sellToken, buyToken ('Quote'),
      //            input.token, reactor, swapper,
      //            output.token, out.recipient
      CALLDATA_GAS_COST.ADDRESS * 7 +
      CALLDATA_GAS_COST.TIMESTAMP * 6 +
      // uint256: q.sellAmt, q.buyAmt, fillThreshold,
      //          input.start/end, output.start/end
      CALLDATA_GAS_COST.AMOUNT * 7 +
      // signatures: rfq signature, order's signature.
      (CALLDATA_GAS_COST.FULL_WORD * 2 + CALLDATA_GAS_COST.OFFSET_SMALL) * 2
    );
  }

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<RubiconRfqData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<RubiconRfqData>, ExchangeTxInfo]> {
    try {
      const isSell = side === SwapSide.SELL;
      const isBuy = side === SwapSide.BUY;

      const q: Quote = {
        tag: RUBICON_RFQ_CLIENT_TAG,
        chainId: this.network,
        sellToken: srcToken.address,
        buyToken: destToken.address,
        // Prepare either market buy or market sell request.
        sellAmt: isSell ? optimalSwapExchange.srcAmount.toString() : undefined,
        buyAmt: isBuy ? optimalSwapExchange.destAmount.toString() : undefined,
      };

      const queryParams = Object.keys(q)
        .map(k => {
          const kk = k as keyof Quote;
          const v = q[kk];

          return `${encodeURIComponent(String(kk))}=${encodeURIComponent(
            String(v ? v : ''),
          )}`;
        })
        .join('&');

      const url = new URL(
        `${RUBICON_RFQ_API_URL}${RUBICON_RFQ_MARKET_MATCH_ENDPOINT}?${queryParams}`,
      ).toString();

      const match: RubiconRfqMatchResponse =
        await this.dexHelper.httpRequest.get(
          url,
          RUBICON_RFQ_MARKET_MATCH_TIMEOUT_MS,
          { 'x-api-Key': this.rubiconRfqAuthToken },
        );

      if (!match) {
        const message = `${this.dexKey}-${
          this.network
        }: Failed to get a match for ${this.pairToMarketId(
          srcToken,
          destToken,
        )}: ${JSON.stringify(q)}`;
        this.logger.warn(message);
        throw new RfqError(message);
      }

      if (match.status !== 'success') {
        const message = `${this.dexKey}-${
          this.network
        }: Failed to get a match for ${this.pairToMarketId(
          srcToken,
          destToken,
        )}: ${JSON.stringify(q)}`;
        this.logger.warn(message);
        throw new RfqError(message, 'ERR_BAD_SERVER');
      }

      if (!match.rfqsig) {
        const message = `${this.dexKey}-${
          this.network
        }: Failed to fetch RFQ for ${this.pairToMarketId(
          srcToken,
          destToken,
        )}. Missing signature`;
        this.logger.warn(message);
        throw new RfqError(message, 'ERR_NO_SIGNATURE');
      }

      if (!match.response) {
        const message = `${this.dexKey}-${
          this.network
        }: Failed to fetch RFQ for ${this.pairToMarketId(
          srcToken,
          destToken,
        )}. Missing match data`;
        this.logger.warn(message);
        throw new RfqError(message, 'ERR_NO_MATCH');
      }

      // Idk if that's an error, but I assume
      // only full fills are needed.
      if (match.fillType === RUBICON_RFQ_PARTIAL_FILL) {
        const message = `${this.dexKey}-${
          this.network
        }: Failed to fetch RFQ for ${this.pairToMarketId(
          srcToken,
          destToken,
        )}. Order can be filled only partially`;
        this.logger.warn(message);
        throw new RfqError(message, 'ERR_PARTIAL_FILL');
      }

      assert(
        match.pair.sellToken === destToken.address,
        `Match sellToken=${match.pair.sellToken} is different from destToken=${destToken.address}`,
      );
      assert(
        match.pair.buyToken === srcToken.address,
        `QuoteData buyToken=${match.pair.buyToken} is different from srcToken=${srcToken.address}`,
      );

      const deadlineBigInt = BigInt(match.response.deadline);
      const deadline = deadlineBigInt > 0 ? deadlineBigInt : BI_MAX_UINT256;

      const matchSellAmt = BigInt(match.amounts.sellAmt);
      const matchBuyAmt = BigInt(match.amounts.buyAmt);

      const srcAmount = BigInt(optimalSwapExchange.srcAmount);
      const destAmount = BigInt(optimalSwapExchange.destAmount);

      const slippageFactor = options.slippageFactor;

      let isFailOnSlippage = false;
      let slippageErrorMessage = '';

      if (isSell) {
        if (
          matchSellAmt <
          BigInt(
            new BigNumber(destAmount.toString())
              .times(slippageFactor)
              .toFixed(0),
          )
        ) {
          isFailOnSlippage = true;
          const message = `${this.dexKey}-${this.network}: too much slippage on quote ${side} matchSellAmt ${matchSellAmt} / destAmount ${destAmount} < ${slippageFactor}`;
          slippageErrorMessage = message;
          this.logger.warn(message);
        }
      }

      if (isBuy) {
        if (
          matchBuyAmt >
          BigInt(
            slippageFactor
              .times(optimalSwapExchange.srcAmount.toString())
              .toFixed(0),
          )
        ) {
          isFailOnSlippage = true;

          const message = `${this.dexKey}-${this.network}: too much slippage on quote ${side}  matchBuyAmt ${matchBuyAmt} > srcAmount ${srcAmount}`;
          slippageErrorMessage = message;
          this.logger.warn(message);
        }
      }

      let isTooStrictSlippage = false;
      if (
        isFailOnSlippage &&
        isSell &&
        new BigNumber(1)
          .minus(slippageFactor)
          .lt(RUBICON_RFQ_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION)
      ) {
        isTooStrictSlippage = true;
      } else if (
        isFailOnSlippage &&
        isBuy &&
        slippageFactor
          .minus(1)
          .lt(RUBICON_RFQ_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION)
      ) {
        isTooStrictSlippage = true;
      }

      if (isFailOnSlippage && isTooStrictSlippage) {
        throw new TooStrictSlippageCheckError(slippageErrorMessage);
      } else if (isFailOnSlippage && !isTooStrictSlippage) {
        throw new SlippageCheckError(slippageErrorMessage);
      }

      return [
        {
          ...optimalSwapExchange,
          data: {
            q: {
              sellToken: srcToken.address,
              buyToken: destToken.address,
              sellAmt: srcAmount,
              buyAmt: destAmount > matchSellAmt ? matchSellAmt : destAmount,
            },
            r: {
              orders: match.response.orders,
              quantities: match.response.quantities.map(q => BigInt(q)),
              deadline: Number(deadline),
            },
            signature: match.rfqsig,
          },
        },
        { deadline: deadline },
      ];
    } catch (e) {
      if (e instanceof TooStrictSlippageCheckError) {
        this.logger.warn(
          `${this.dexKey}-${this.network}: Failed to build transaction on side ${side} with too strict slippage. Skipping restriction`,
        );
      } else {
        this.logger.warn(
          `${this.dexKey}-${this.network} unknown preprocess transaction error: ${e}`,
        );
      }

      throw e;
    }
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: RubiconRfqData,
    side: SwapSide,
  ): DexExchangeParam {
    const { q, r, signature } = data;

    assert(q !== undefined, `${this.dexKey}-${this.network}: q undefined`);
    assert(r !== undefined, `${this.dexKey}-${this.network}: r undefined`);
    assert(
      signature !== undefined,
      `${this.dexKey}-${this.network}: signature undefined`,
    );

    const exchangeData = this.rubiconRfqInterface.encodeFunctionData('fill', [
      q,
      r,
      signature,
    ]);

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: false,
      exchangeData,
      targetExchange: this.rfqAddress,
      returnAmountPos: undefined,
    };
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: RubiconRfqData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: this.rfqAddress,
      payload: '',
      networkFee: '0',
    };
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const liquidity = (await this.getCachedLiquidity()) || {};
    const token = tokenAddress.toLowerCase();

    const marketIds = Object.keys(liquidity).filter(id =>
      this.marketIdToPair(id).includes(token),
    );
    if (marketIds.length === 0) {
      return [];
    }

    const pools = marketIds.map(
      id =>
        ({
          exchange: this.dexKey,
          address: this.rfqAddress,
          connectorTokens: [this.extractQuoteToken(id, token)],
          liquidityUSD: +liquidity[id],
        } as PoolLiquidity),
    );

    return pools
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, limit);
  }

  async getCachedMarkets(): Promise<
    RubiconRfqMarketsResponse['markets'] | null
  > {
    const cachedMarkets = await this.dexHelper.cache.rawget(
      this.marketsCacheKey,
    );

    if (cachedMarkets) {
      return JSON.parse(cachedMarkets) as RubiconRfqMarketsResponse['markets'];
    }

    return null;
  }

  async getCachedLiquidity(): Promise<
    RubiconRfqLiquidityResponse['liquidityUsd'] | null
  > {
    const cachedLiq = await this.dexHelper.cache.rawget(this.liquidityCacheKey);

    if (cachedLiq) {
      return JSON.parse(
        cachedLiq,
      ) as RubiconRfqLiquidityResponse['liquidityUsd'];
    }

    return null;
  }

  releaseResources(): void {
    if (this.rateFetcher) {
      this.rateFetcher.stop();
    }
  }
}
