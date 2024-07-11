import {
  Address,
  NumberAsString,
  SwapSide,
  OptimalSwapExchange,
} from '@paraswap/core';
import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  PreprocessTransactionOptions,
  ExchangeTxInfo,
  AdapterExchangeParam,
  SimpleExchangeParam,
  DexExchangeParam,
  TxInfo,
  TransferFeeParams,
  ExchangePrices,
  PoolPrices,
  PoolLiquidity,
  Logger,
} from '../../types';
import { Context, IDex } from '../idex';
import { SimpleExchange } from '../simple-exchange';
import { Network } from '../../constants';
import { getDexKeysWithNetwork } from '../../utils';
import { CablesAdapters, CablesConfig } from './config';
import { IDexHelper } from '../../dex-helper';
import { CablesRateFetcher } from './rate-fetcher';
import { CablesData, PairData } from './types';
import { CABLES_API_URL, CABLES_GAS_COST } from './constants';

export class Cables extends SimpleExchange implements IDex<any> {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(CablesConfig);
  private rateFetcher: CablesRateFetcher;
  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = CablesAdapters[network] || {}, // readonly routerAddress: string = HashflowConfig['Hashflow'][network] //   .routerAddress, // protected routerInterface = new Interface(routerAbi),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);

    this.rateFetcher = new CablesRateFetcher(
      this.dexHelper,
      this.dexKey,
      this.network,
      this.logger,
      {
        rateConfig: {
          pairsReqParams: {
            url: CABLES_API_URL + '/pairs',
            // headers?: RequestHeaders;
            // params?: any;
          },
          pricesReqParams: {
            url: CABLES_API_URL + '/prices',
            // headers?: RequestHeaders;
            // params?: any;
          },
          blacklistReqParams: {
            url: CABLES_API_URL + '/blacklist',
            // headers?: RequestHeaders;
            // params?: any;
          },
          tokensReqParams: {
            url: CABLES_API_URL + '/tokens',
            // headers: undefined,
            // params: undefined,
          },

          pricesIntervalMs: 2000,
          pairsIntervalMs: 10000,
          blacklistIntervalMs: 30000,
          tokensIntervalMs: 30000,

          pairsCacheKey: 'cablesPairsCacheKey',
          pricesCacheKey: 'cablesPricesCacheKey',
          tokensCacheKey: 'cablesTokensCacheKey',
          blacklistCacheKey: 'cablesBlacklistCacheKey',

          pairsCacheTTLSecs: 2,
          pricesCacheTTLSecs: 10,
          blacklistCacheTTLSecs: 30,
          tokensCacheTTLSecs: 30,
        },
      },
    );
  }

  hasConstantPriceLargeAmounts: boolean = false;

  needsSequentialPreprocessing?: boolean | undefined;
  getNetworkFee?(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: CablesData,
    side: SwapSide,
  ): NumberAsString {
    throw new Error('Method not implemented.');
  }
  preProcessTransaction?(
    optimalSwapExchange: OptimalSwapExchange<CablesData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): AsyncOrSync<[OptimalSwapExchange<CablesData>, ExchangeTxInfo]> {
    throw new Error('Method not implemented.');
  }
  getTokenFromAddress?(address: Address): Token {
    throw new Error('Method not implemented.');
  }
  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: CablesData,
    side: SwapSide,
  ): AdapterExchangeParam {
    throw new Error('Method not implemented.');
  }
  getSimpleParam?(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: CablesData,
    side: SwapSide,
  ): AsyncOrSync<SimpleExchangeParam> {
    throw new Error('Method not implemented.');
  }
  getDexParam?(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: CablesData,
    side: SwapSide,
    context: Context,
    executorAddress: Address,
  ): AsyncOrSync<DexExchangeParam> {
    throw new Error('Method not implemented.');
  }
  getDirectParam?(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    expectedAmount: NumberAsString,
    data: CablesData,
    side: SwapSide,
    permit: string,
    uuid: string,
    feePercent: NumberAsString,
    deadline: NumberAsString,
    partner: string,
    beneficiary: string,
    contractMethod?: string,
  ): TxInfo<null> {
    throw new Error('Method not implemented.');
  }
  getDirectParamV6?(
    srcToken: Address,
    destToken: Address,
    fromAmount: NumberAsString,
    toAmount: NumberAsString,
    quotedAmount: NumberAsString,
    data: CablesData,
    side: SwapSide,
    permit: string,
    uuid: string,
    partnerAndFee: string,
    beneficiary: string,
    blockNumber: number,
    contractMethod?: string,
  ): TxInfo<null> {
    throw new Error('Method not implemented.');
  }
  isStatePollingDex?: boolean | undefined;

  normalizeToken(token: Token): Token {
    return {
      ...token,
      address: token.address.toLowerCase(),
    };
  }

  /**
   * POOLS
   */
  getPoolIdentifier(srcAddress: Address, destAddress: Address, mm?: string) {
    return `${this.dexKey}_${srcAddress}_${destAddress}`.toLowerCase();
    return `${this.dexKey}_${srcAddress}_${destAddress}_${mm}`.toLowerCase();
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

    // TODO - remove hardcoding
    const makers = ['0x5aFF01E3A80790c75F15fc6AEBd615c8343d4126'];
    const levels: Record<string, any> = {
      '0x5aFF01E3A80790c75F15fc6AEBd615c8343d4126': [
        {
          pair: {
            baseToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
            quoteToken: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
          },
        },
      ],
    };

    const result = makers
      .filter((m: string) => {
        const pairs = levels[m]?.map((el: { pair: string }) => el.pair) ?? [];
        return pairs.some(
          (p: { baseToken: string; quoteToken: string }) =>
            normalizedSrcToken.address === p.baseToken.toLowerCase() &&
            normalizedDestToken.address === p.quoteToken.toLowerCase(),
        );
      })
      .map(m =>
        this.getPoolIdentifier(
          normalizedSrcToken.address,
          normalizedDestToken.address,
          m,
        ),
      );

    return result;
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
    transferFees?: TransferFeeParams,
    isFirstSwap?: boolean,
  ): Promise<ExchangePrices<CablesData> | null> {
    try {
      const normalizedSrcToken = this.normalizeToken(srcToken);
      const normalizedDestToken = this.normalizeToken(destToken);
      // If: same token, return null
      if (normalizedSrcToken.address === normalizedDestToken.address) {
        return null;
      }

      let pools = await this.getPoolIdentifiers(
        srcToken,
        destToken,
        side,
        blockNumber,
      );
      if (pools.length === 0) {
        return null;
      }

      const prices = await this.getCachedPrices();
      if (!prices) {
        return null;
      }

      let pairKey = `${normalizedSrcToken.symbol}/${normalizedDestToken.symbol}`;
      if (!(pairKey in Object.keys(prices))) {
        // Revert
        pairKey = `${normalizedDestToken.symbol}/${normalizedSrcToken.symbol}`;
        if (!(pairKey in Object.keys(prices))) {
          return null;
        }
      }

      const priceData = prices[pairKey];
      const baseToken = normalizedSrcToken.symbol;
      const quoteToken = normalizedDestToken.symbol;

      /**
       * Orderbook
       */
      let orderbook;
      if (side === SwapSide.BUY) {
        priceData.asks;
      } else {
        orderbook = priceData.bids;
      }
      if (orderbook.length === 0) {
        throw new Error(`Empty orderbook for ${pairKey}`);
      }

      const orderPrice = 0;
      // const orderPrice = this.calculateOrderPrice(
      //   amounts,
      //   orderbook,
      //   baseToken,
      //   quoteToken,
      //   isInputQuote,
      // );

      const outDecimals =
        side === SwapSide.BUY
          ? normalizedSrcToken.decimals
          : normalizedDestToken.decimals;
      return [
        {
          prices,
          unit: BigInt(outDecimals),
          exchange: this.dexKey,
          gasCost: CABLES_GAS_COST,
          data: {},
        },
      ];
    } catch (e: unknown) {
      this.logger.error(
        `Error in getPricesVolume`,
        {
          srcToken: srcToken.address || srcToken.symbol,
          destToken: destToken.address || destToken.symbol,
          side,
        },
        e,
      );
      return null;
    }
  }

  getCalldataGasCost(poolPrices: PoolPrices<CablesData>): number | number[] {
    throw new Error('Method not implemented.');
  }

  async initializePricing(blockNumber: number): Promise<void> {
    if (!this.dexHelper.config.isSlave) {
      this.rateFetcher.start();
    }

    return;
  }
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }
  releaseResources?(): AsyncOrSync<void> {
    if (this.rateFetcher) {
      this.rateFetcher.stop();
    }
  }
  addMasterPool?(poolKey: string, blockNumber: number): AsyncOrSync<boolean> {
    throw new Error('Method not implemented.');
  }

  /**
   * Blacklist
   */
  isBlacklisted?(userAddress?: Address): AsyncOrSync<boolean> {
    throw new Error('Method not implemented.');
  }
  setBlacklist?(userAddress?: Address): AsyncOrSync<boolean> {
    throw new Error('Method not implemented.');
  }

  updatePoolState?(): AsyncOrSync<void> {
    throw new Error('Method not implemented.');
  }
  getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): AsyncOrSync<PoolLiquidity[]> {
    throw new Error('Method not implemented.');
  }

  /**
   * CACHED UTILS
   */
  async getCachedTokens(): Promise<any> {
    const cachedTokens = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.rateFetcher.tokensCacheKey,
    );

    return cachedTokens ? JSON.parse(cachedTokens) : {};
  }
  async getCachedPairs(): Promise<any> {
    const cachedPairs = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.rateFetcher.pairsCacheKey,
    );

    return cachedPairs ? JSON.parse(cachedPairs) : {};
  }
  async getCachedPrices(): Promise<any> {
    const cachedPrices = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.rateFetcher.pricesCacheKey,
    );

    return cachedPrices ? JSON.parse(cachedPrices) : {};
  }
  async getCachedTokensAddr(): Promise<any> {
    const tokens = await this.getCachedTokens();
    const tokensAddr: Record<string, Address> = {};
    for (const addr of Object.keys(tokens)) {
      tokensAddr[tokens[addr].symbol.toLowerCase()] = addr;
    }
    return tokensAddr;
  }

  getPairString(baseToken: Token, quoteToken: Token): string {
    return `${baseToken.symbol}/${quoteToken.symbol}`.toLowerCase();
  }

  async getPairData(srcToken: Token, destToken: Token): Promise<any> {
    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);
    if (normalizedSrcToken.address === normalizedDestToken.address) {
      return null;
    }

    const cachedTokens = await this.getCachedTokens();
    if (
      !(normalizedSrcToken.address in cachedTokens) ||
      !(normalizedDestToken.address in cachedTokens)
    ) {
      return null;
    }
    normalizedSrcToken.symbol = cachedTokens[normalizedSrcToken.address].symbol;
    normalizedDestToken.symbol =
      cachedTokens[normalizedDestToken.address].symbol;

    const cachedPairs = await this.getCachedPairs();
    const potentialPairs = [
      {
        base: normalizedSrcToken.symbol,
        quote: normalizedDestToken.symbol,
        identifier: this.getPairString(normalizedSrcToken, normalizedDestToken),
        isSrcBase: true,
      },
      {
        base: normalizedDestToken.symbol,
        quote: normalizedSrcToken.symbol,
        identifier: this.getPairString(normalizedDestToken, normalizedSrcToken),
        isSrcBase: false,
      },
    ];

    for (const pair of potentialPairs) {
      if (pair.identifier in cachedPairs) {
        const pairData = cachedPairs[pair.identifier];
        pairData.isSrcBase = pair.isSrcBase;
        return pairData;
      }
    }
    return null;
  }
}
