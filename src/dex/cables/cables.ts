import {
  Address,
  NumberAsString,
  OptimalSwapExchange,
  SwapSide,
} from '@paraswap/core';
import { assert, AsyncOrSync } from 'ts-essentials';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { ETHER_ADDRESS, Network, NULL_ADDRESS } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import {
  AdapterExchangeParam,
  DexExchangeParam,
  ExchangePrices,
  ExchangeTxInfo,
  Logger,
  PoolLiquidity,
  PoolPrices,
  PreprocessTransactionOptions,
  Token,
  TransferFeeParams,
} from '../../types';
import { getDexKeysWithNetwork, Utils } from '../../utils';
import { IDex } from '../idex';
import { SimpleExchange } from '../simple-exchange';
import { CablesConfig } from './config';
import {
  CABLES_API_BLACKLIST_POLLING_INTERVAL_MS,
  CABLES_API_PAIRS_POLLING_INTERVAL_MS,
  CABLES_API_PRICES_POLLING_INTERVAL_MS,
  CABLES_API_TOKENS_POLLING_INTERVAL_MS,
  CABLES_API_URL,
  CABLES_BLACKLIST_CACHE_KEY,
  CABLES_BLACKLIST_CACHES_TTL_S,
  CABLES_ERRORS_CACHE_KEY,
  CABLES_FIRM_QUOTE_TIMEOUT_MS,
  CABLES_GAS_COST,
  CABLES_PAIRS_CACHES_TTL_S,
  CABLES_PRICES_CACHES_TTL_S,
  CABLES_RESTRICT_CHECK_INTERVAL_MS,
  CABLES_RESTRICT_COUNT_THRESHOLD,
  CABLES_RESTRICT_TTL_S,
  CABLES_RESTRICTED_CACHE_KEY,
  CABLES_TOKENS_CACHES_TTL_S,
} from './constants';
import { CablesRateFetcher } from './rate-fetcher';
import {
  CablesData,
  CablesRFQResponse,
  RestrictData,
  SlippageError,
} from './types';
import mainnetRFQAbi from '../../abi/cables/CablesMainnetRFQ.json';
import { Interface } from 'ethers/lib/utils';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { BI_MAX_UINT256 } from '../../bigint-constants';
import _ from 'lodash';

export class Cables extends SimpleExchange implements IDex<any> {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(CablesConfig);

  readonly isStatePollingDex = true;

  private rateFetcher: CablesRateFetcher;

  logger: Logger;
  private tokensMap: { [address: string]: Token } = {};

  hasConstantPriceLargeAmounts: boolean = false;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    readonly mainnetRFQAddress: string = CablesConfig['Cables'][network]
      .mainnetRFQAddress,
    protected rfqInterface = new Interface(mainnetRFQAbi),
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
          },
          pricesReqParams: {
            url: CABLES_API_URL + '/prices',
          },
          blacklistReqParams: {
            url: CABLES_API_URL + '/blacklist',
          },
          tokensReqParams: {
            url: CABLES_API_URL + '/tokens',
          },

          pricesIntervalMs: CABLES_API_PRICES_POLLING_INTERVAL_MS,
          pricesCacheTTLSecs: CABLES_PRICES_CACHES_TTL_S,
          pricesCacheKey: 'prices',

          pairsIntervalMs: CABLES_API_PAIRS_POLLING_INTERVAL_MS,
          pairsCacheTTLSecs: CABLES_PAIRS_CACHES_TTL_S,
          pairsCacheKey: 'pairs',

          tokensIntervalMs: CABLES_API_TOKENS_POLLING_INTERVAL_MS,
          tokensCacheTTLSecs: CABLES_TOKENS_CACHES_TTL_S,
          tokensCacheKey: 'tokens',

          blacklistIntervalMs: CABLES_API_BLACKLIST_POLLING_INTERVAL_MS,
          blacklistCacheTTLSecs: CABLES_BLACKLIST_CACHES_TTL_S,
          blacklistCacheKey: CABLES_BLACKLIST_CACHE_KEY,

          tokensHandleResponseCallback: async () => {
            await this.setTokensMap();
          },
        },
      },
    );
  }

  async preProcessTransaction?(
    optimalSwapExchange: OptimalSwapExchange<CablesData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<CablesData>, ExchangeTxInfo]> {
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

    if (BigInt(optimalSwapExchange.srcAmount) === 0n) {
      throw new Error('getFirmRate failed with srcAmount === 0');
    }

    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);
    const swapIdentifier = `${this.dexKey}_${normalizedSrcToken.address}_${normalizedDestToken.address}_${side}`;

    try {
      let makerToken = normalizedDestToken;
      let takerToken = normalizedSrcToken;

      const isSell = side === SwapSide.SELL;
      const isBuy = side === SwapSide.BUY;

      const rfqParams = {
        makerAsset: ethers.utils.getAddress(makerToken.address),
        takerAsset: ethers.utils.getAddress(takerToken.address),
        ...(isBuy && { makerAmount: optimalSwapExchange.destAmount }),
        ...(isSell && { takerAmount: optimalSwapExchange.srcAmount }),
        userAddress: options.executionContractAddress,
        chainId: String(this.network),
      };

      const rfq: CablesRFQResponse = await this.dexHelper.httpRequest.post(
        `${CABLES_API_URL}/quote`,
        rfqParams,
        CABLES_FIRM_QUOTE_TIMEOUT_MS,
      );

      if (!rfq) {
        throw new Error(
          'Failed to fetch RFQ' +
            swapIdentifier +
            JSON.stringify(rfq + 'params' + rfqParams),
        );
      }

      const { order } = rfq;

      assert(
        order.makerAsset.toLowerCase() === makerToken.address,
        `QuoteData makerAsset=${order.makerAsset} is different from Paraswap makerAsset=${makerToken.address}`,
      );
      assert(
        order.takerAsset.toLowerCase() === takerToken.address,
        `QuoteData takerAsset=${order.takerAsset} is different from Paraswap takerAsset=${takerToken.address}`,
      );
      if (isSell) {
        assert(
          order.takerAmount === optimalSwapExchange.srcAmount,
          `QuoteData takerAmount=${order.takerAmount} is different from Paraswap srcAmount=${optimalSwapExchange.srcAmount}`,
        );
      } else {
        assert(
          order.makerAmount === optimalSwapExchange.destAmount,
          `QuoteData makerAmount=${order.makerAmount} is different from Paraswap destAmount=${optimalSwapExchange.destAmount}`,
        );
      }

      const expiryAsBigInt = BigInt(order.expiry);
      const minDeadline = expiryAsBigInt > 0 ? expiryAsBigInt : BI_MAX_UINT256;

      if (side === SwapSide.BUY) {
        const requiredAmount = BigInt(optimalSwapExchange.srcAmount);
        const quoteAmount = BigInt(order.takerAmount);
        const requiredAmountWithSlippage = new BigNumber(
          requiredAmount.toString(),
        )
          .multipliedBy(options.slippageFactor)
          .toFixed(0);
        if (quoteAmount > BigInt(requiredAmountWithSlippage)) {
          throw new SlippageError(
            `Slipped, factor: ${quoteAmount.toString()} > ${requiredAmountWithSlippage}`,
          );
        }
      } else {
        const requiredAmount = BigInt(optimalSwapExchange.destAmount);
        const quoteAmount = BigInt(order.makerAmount);
        const requiredAmountWithSlippage = new BigNumber(
          requiredAmount.toString(),
        )
          .multipliedBy(options.slippageFactor)
          .toFixed(0);
        if (quoteAmount < BigInt(requiredAmountWithSlippage)) {
          throw new SlippageError(
            `Slipped, factor: ${
              options.slippageFactor
            } ${quoteAmount.toString()} < ${requiredAmountWithSlippage}`,
          );
        }
      }

      return [
        {
          ...optimalSwapExchange,
          data: {
            quoteData: order,
          },
        },
        { deadline: minDeadline },
      ];
    } catch (e: any) {
      const message = `${this.dexKey}-${this.network}: ${e}`;
      this.logger.error(message);
      if (!e?.isSlippageError) {
        this.restrict();
      }
      throw new Error(message);
    }
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: CablesData,
    side: SwapSide,
  ): DexExchangeParam {
    const { quoteData } = data;

    assert(
      quoteData !== undefined,
      `${this.dexKey}-${this.network}: quoteData undefined`,
    );

    const swapFunction = 'partialSwap';
    const swapFunctionParams = [
      [
        quoteData.nonceAndMeta,
        quoteData.expiry,
        quoteData.makerAsset,
        quoteData.takerAsset,
        quoteData.maker,
        quoteData.taker,
        quoteData.makerAmount,
        quoteData.takerAmount,
      ],
      quoteData.signature,
      // might be overwritten on Executors
      quoteData.takerAmount,
    ];

    const exchangeData = this.rfqInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    const fromAmount = ethers.utils.defaultAbiCoder.encode(
      ['uint256'],
      [quoteData.takerAmount],
    );

    const filledAmountIndex = exchangeData
      .replace('0x', '')
      .lastIndexOf(fromAmount.replace('0x', ''));

    const filledAmountPos =
      (filledAmountIndex !== -1 ? filledAmountIndex : exchangeData.length) / 2;

    return {
      exchangeData,
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: false,
      targetExchange: this.mainnetRFQAddress,
      returnAmountPos: undefined,
      insertFromAmountPos: filledAmountPos,
    };
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CablesData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { quoteData } = data;

    assert(
      quoteData !== undefined,
      `${this.dexKey}-${this.network}: quoteData undefined`,
    );

    const params = [
      {
        nonceAndMeta: quoteData.nonceAndMeta,
        expiry: quoteData.expiry,
        makerAsset: quoteData.makerAsset,
        takerAsset: quoteData.takerAsset,
        maker: quoteData.maker,
        taker: quoteData.taker,
        makerAmount: quoteData.makerAmount,
        takerAmount: quoteData.takerAmount,
      },
      quoteData.signature,
    ];

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          order: {
            nonceAndMeta: 'uint256',
            expiry: 'uint128',
            makerAsset: 'address',
            takerAsset: 'address',
            maker: 'address',
            taker: 'address',
            makerAmount: 'uint256',
            takerAmount: 'uint256',
          },
          signature: 'bytes',
        },
      },
      {
        order: params[0],
        signature: params[1],
      },
    );

    return {
      targetExchange: this.mainnetRFQAddress,
      payload,
      networkFee: '0',
    };
  }

  normalizeToken(token: Token): Token {
    return {
      ...token,
      address: this.normalizeTokenAddress(token.address),
    };
  }

  normalizeTokenAddress(address: Address): Address {
    return address.toLowerCase();
  }

  getTokenFromAddress(address: Address): Token {
    return this.tokensMap[this.normalizeAddress(address)];
  }

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
    await this.setTokensMap();

    if (!srcToken || !destToken) {
      return [];
    }

    if (srcToken.address.toLowerCase() === destToken.address.toLowerCase()) {
      return [];
    }

    const pairData = await this.getPairData(srcToken, destToken);

    if (!pairData) {
      return [];
    }

    const tokensAddr = (await this.getCachedTokensAddr()) || {};

    return [
      this.getPoolIdentifier(
        tokensAddr[pairData.base.toLowerCase()],
        tokensAddr[pairData.quote.toLowerCase()],
      ),
    ];
  }

  calculateOrderPrice(
    amounts: bigint[],
    orderbook: string[][],
    baseToken: Token,
    quoteToken: Token,
    isInputQuote: boolean,
  ) {
    let result = [];

    for (let i = 0; i < amounts.length; i++) {
      let amt = amounts[i];
      if (amt === 0n) {
        result.push(amt);
        continue;
      }

      let decimals = baseToken.decimals;
      let out_decimals = quoteToken.decimals;

      let price = this.calculatePriceSwap(
        orderbook,
        Number(amt) / 10 ** decimals,
        isInputQuote,
      );
      result.push(BigInt(Math.round(price * 10 ** out_decimals)));
    }
    return result;
  }

  calculatePriceSwap(
    prices: string[][],
    requiredQty: number,
    qtyMode: Boolean,
  ) {
    let sumBaseQty = 0;
    let sumQuoteQty = 0;
    const selectedRows: string[][] = [];

    const isBase = qtyMode;
    const isQuote = !qtyMode;

    for (const [price, volume] of prices) {
      if (isBase) {
        if (sumBaseQty >= requiredQty) {
          break;
        }
      }

      if (isQuote) {
        if (sumQuoteQty >= requiredQty) {
          break;
        }
      }

      let currentBaseQty = Number(volume);
      let currentQuoteQty = Number(volume) * Number(price);

      const overQty = isBase
        ? currentBaseQty + sumBaseQty > requiredQty
        : currentQuoteQty + sumQuoteQty > requiredQty;

      if (overQty) {
        if (isBase) {
          currentBaseQty = requiredQty - sumBaseQty;
          currentQuoteQty = currentBaseQty * Number(price);
        }

        if (isQuote) {
          currentQuoteQty = requiredQty - sumQuoteQty;
          currentBaseQty =
            currentQuoteQty *
            new BigNumber(1).dividedBy(new BigNumber(price)).toNumber();
        }
      }

      sumBaseQty += currentBaseQty;
      sumQuoteQty += currentQuoteQty;
      selectedRows.push([price, currentBaseQty.toString()]);
    }

    const vSumBase = selectedRows.reduce((sum: number, [price, volume]) => {
      return sum + Number(price) * Number(volume);
    }, 0);

    const price = new BigNumber(vSumBase)
      .dividedBy(new BigNumber(sumBaseQty))
      .toNumber();

    if (isBase) {
      return requiredQty / price;
    } else {
      return requiredQty * price;
    }
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
    const isRestricted = await this.isRestricted();
    if (isRestricted) {
      return null;
    }

    await this.setTokensMap();

    try {
      const normalizedSrcToken = this.normalizeToken(srcToken);
      const normalizedDestToken = this.normalizeToken(destToken);
      // If: same token, return null
      if (
        normalizedSrcToken.address.toLowerCase() ===
        normalizedDestToken.address.toLowerCase()
      ) {
        return null;
      }

      for (const symbol of Object.keys(this.tokensMap)) {
        const normalizedTokenAddress =
          this.tokensMap[symbol].address.toLowerCase();

        if (normalizedSrcToken.address === normalizedTokenAddress) {
          normalizedSrcToken.symbol = this.tokensMap[symbol].symbol;
        }
        if (normalizedDestToken.address === normalizedTokenAddress) {
          normalizedDestToken.symbol = this.tokensMap[symbol].symbol;
        }
      }

      // ---------- Pools ----------
      let pools = await this.getPoolIdentifiers(
        srcToken,
        destToken,
        side,
        blockNumber,
      );
      if (pools.length === 0) return null;

      // ---------- Prices ----------
      const priceMap = await this.getCachedPrices();

      if (!priceMap) return null;

      let isInputQuote = false;
      let pairKey = `${normalizedSrcToken.symbol}/${normalizedDestToken.symbol}`;
      const pairsKeys = Object.keys(priceMap);

      if (!pairsKeys.includes(pairKey)) {
        // Revert
        isInputQuote = true;
        pairKey = `${normalizedDestToken.symbol}/${normalizedSrcToken.symbol}`;
        if (!pairsKeys.includes(pairKey)) {
          return null;
        }
      }

      /**
       * Orderbook
       */
      const priceData = priceMap[pairKey];

      let orderbook: any[] = [];
      if (side === SwapSide.BUY) {
        orderbook = priceData.asks;
      } else {
        orderbook = priceData.bids;
      }
      if (orderbook?.length === 0) {
        throw new Error(`Empty orderbook for ${pairKey}`);
      }

      const prices = this.calculateOrderPrice(
        amounts,
        orderbook,
        side === SwapSide.SELL ? srcToken : destToken,
        side === SwapSide.SELL ? destToken : srcToken,
        side === SwapSide.SELL ? isInputQuote : !isInputQuote,
      );

      const result = [
        {
          prices: prices,
          unit: BigInt(normalizedDestToken.decimals),
          exchange: this.dexKey,
          gasCost: CABLES_GAS_COST,
          poolAddresses: [this.mainnetRFQAddress],
          data: {},
        },
      ];

      return result;
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
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      // addresses: makerAsset, takerAsset, maker, taker
      CALLDATA_GAS_COST.ADDRESS * 4 +
      // uint256: expiry
      CALLDATA_GAS_COST.wordNonZeroBytes(16) +
      // uint256: nonceAndMeta, makerAmount, takerAmount
      CALLDATA_GAS_COST.AMOUNT * 3 +
      // bytes: _signature (65 bytes)
      CALLDATA_GAS_COST.FULL_WORD * 2 +
      CALLDATA_GAS_COST.OFFSET_SMALL
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

  releaseResources?(): AsyncOrSync<void> {
    if (this.rateFetcher) {
      this.rateFetcher.stop();
    }
  }

  normalizeAddress(address: string): string {
    return address.toLowerCase() === ETHER_ADDRESS
      ? NULL_ADDRESS
      : address.toLowerCase();
  }

  async setTokensMap() {
    const tokens = await this.getCachedTokens();

    if (tokens) {
      this.tokensMap = Object.keys(tokens).reduce((acc, key) => {
        //@ts-ignore
        acc[tokens[key].address.toLowerCase()] = tokens[key];
        return acc;
      }, {});
    }
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const isETH = tokenAddress.toLowerCase() === ETHER_ADDRESS;
    const denormalizedTokenAddress = isETH ? NULL_ADDRESS : tokenAddress;

    const tokens = (await this.getCachedTokens()) as { [key: string]: Token };
    const token = Object.values(tokens).find(
      token =>
        token.address.toLowerCase() === denormalizedTokenAddress.toLowerCase(),
    );

    if (!token) {
      return [];
    }

    const pairs = (await this.getCachedPairs()) as {
      [key: string]: { base: string; quote: string };
    };

    const connectorTokens = Object.keys(pairs)
      .filter(pairKey => {
        const { base, quote } = pairs[pairKey];

        if (
          base.toLowerCase() === token.symbol?.toLowerCase() ||
          quote.toLowerCase() === token.symbol?.toLowerCase()
        ) {
          return true;
        }

        return false;
      })
      .map(pairKey => {
        const { base, quote } = pairs[pairKey];

        if (base.toLowerCase() === token.symbol?.toLowerCase()) {
          return tokens[quote];
        }

        if (quote.toLowerCase() === token.symbol?.toLowerCase()) {
          return tokens[base];
        }
      });

    if (connectorTokens.length === 0) {
      return [];
    }

    connectorTokens.push(token);

    const tokensBalanceMultiCall = connectorTokens.map(token => {
      let erc20BalanceCalldata;
      if (token?.address.toLowerCase() === NULL_ADDRESS) {
        erc20BalanceCalldata = this.dexHelper.multiContract.methods
          .getEthBalance(this.mainnetRFQAddress)
          .encodeABI();
      } else {
        erc20BalanceCalldata = this.erc20Interface.encodeFunctionData(
          'balanceOf',
          [this.mainnetRFQAddress],
        );
      }

      return {
        target:
          token?.address.toLowerCase() === NULL_ADDRESS
            ? this.dexHelper.config.data.multicallV2Address.toLowerCase()
            : token?.address,
        callData: erc20BalanceCalldata,
      };
    });

    const res = (
      await this.dexHelper.multiContract.methods
        .aggregate(tokensBalanceMultiCall)
        .call()
    ).returnData;

    const balances = res.map((item: any) => {
      if (item === '0x') {
        return 0n;
      }
      return BigInt(item.toString());
    });

    const connectorsPricesUSD = await Promise.all(
      connectorTokens.map(async (token, index) =>
        this.dexHelper.getTokenUSDPrice(token!, balances[index]),
      ),
    );

    const extendedConnectors = connectorTokens.map((token, index) => ({
      ...token,
      usdPrice: connectorsPricesUSD[index],
    }));

    const tokenUSDPrice = _.last(extendedConnectors)!.usdPrice;
    extendedConnectors.pop(); // to remove token which was added before

    const connectors = extendedConnectors.map(connector => {
      return {
        exchange: this.dexKey,
        address: this.mainnetRFQAddress,
        connectorTokens: [
          {
            address:
              connector.address === NULL_ADDRESS
                ? ETHER_ADDRESS
                : connector!.address,
            decimals: connector!.decimals,
          },
        ],
        liquidityUSD: Number(connector!.usdPrice) + Number(tokenUSDPrice),
      };
    });

    return _.slice(
      _.sortBy(connectors as PoolLiquidity[], [pool => -1 * pool.liquidityUSD]),
      0,
      limit,
    );
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
    for (const key of Object.keys(tokens)) {
      tokensAddr[tokens[key].symbol.toLowerCase()] = tokens[key].address;
    }
    return tokensAddr;
  }

  getPairString(baseToken: Token, quoteToken: Token): string {
    return `${baseToken.symbol}/${quoteToken.symbol}`.toLowerCase();
  }

  // Function to find a key by address
  private findKeyByAddress = (
    jsonData: Record<string, { address: string }>,
    targetAddress: string,
  ): string | undefined => {
    const entries = Object.entries(jsonData);
    const foundEntry = entries.find(
      ([_, value]) =>
        value.address.toLowerCase() === targetAddress.toLowerCase(),
    );
    return foundEntry ? foundEntry[0] : undefined;
  };

  async getPairData(srcToken: Token, destToken: Token): Promise<any> {
    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);

    if (normalizedSrcToken.address === normalizedDestToken.address) {
      return null;
    }

    const cachedTokens = await this.getCachedTokens();

    normalizedSrcToken.symbol = this.findKeyByAddress(
      cachedTokens,
      normalizedSrcToken.address,
    );
    normalizedDestToken.symbol = this.findKeyByAddress(
      cachedTokens,
      normalizedDestToken.address,
    );

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

  async isBlacklisted(txOrigin: Address): Promise<boolean> {
    const cachedBlacklist = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      CABLES_BLACKLIST_CACHE_KEY,
    );

    if (cachedBlacklist) {
      const blacklist = JSON.parse(cachedBlacklist) as string[];
      return blacklist.includes(txOrigin.toLowerCase());
    }

    return false;
  }

  async isRestricted(): Promise<boolean> {
    const result = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      CABLES_RESTRICTED_CACHE_KEY,
    );

    return result === 'true';
  }

  async restrict() {
    const errorsDataRaw = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      CABLES_ERRORS_CACHE_KEY,
    );

    const errorsData: RestrictData = Utils.Parse(errorsDataRaw);
    const ERRORS_TTL_S = Math.floor(CABLES_RESTRICT_CHECK_INTERVAL_MS / 1000);

    if (
      !errorsData ||
      errorsData?.addedDatetimeMs + CABLES_RESTRICT_CHECK_INTERVAL_MS <
        Date.now()
    ) {
      this.logger.warn(
        `${this.dexKey}-${this.network}: First encounter of error OR error ocurred outside of threshold, setting up counter`,
      );
      const data: RestrictData = {
        count: 1,
        addedDatetimeMs: Date.now(),
      };
      await this.dexHelper.cache.setex(
        this.dexKey,
        this.network,
        CABLES_ERRORS_CACHE_KEY,
        ERRORS_TTL_S,
        Utils.Serialize(data),
      );
      return;
    } else {
      if (errorsData.count + 1 >= CABLES_RESTRICT_COUNT_THRESHOLD) {
        this.logger.warn(
          `${this.dexKey}-${this.network}: Restricting due to error count=${
            errorsData.count + 1
          } within ${CABLES_RESTRICT_CHECK_INTERVAL_MS / 1000 / 60} minutes`,
        );
        await this.dexHelper.cache.setex(
          this.dexKey,
          this.network,
          CABLES_RESTRICTED_CACHE_KEY,
          CABLES_RESTRICT_TTL_S,
          'true',
        );
      } else {
        this.logger.warn(
          `${this.dexKey}-${this.network}: Error count increased`,
        );
        const data: RestrictData = {
          count: errorsData.count + 1,
          addedDatetimeMs: errorsData.addedDatetimeMs,
        };
        await this.dexHelper.cache.setex(
          this.dexKey,
          this.network,
          CABLES_RESTRICTED_CACHE_KEY,
          ERRORS_TTL_S,
          Utils.Serialize(data),
        );
      }
    }
  }
}
