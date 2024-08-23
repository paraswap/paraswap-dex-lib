import {
  Address,
  NumberAsString,
  OptimalSwapExchange,
  SwapSide,
} from '@paraswap/core';
import { AsyncOrSync } from 'ts-essentials';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { assert } from 'ts-essentials';
import { Network } from '../../constants';
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
  SimpleExchangeParam,
  Token,
  TransferFeeParams,
  TxInfo,
} from '../../types';
import { getDexKeysWithNetwork } from '../../utils';
import { Context, IDex } from '../idex';
import { SimpleExchange } from '../simple-exchange';
import { CablesAdapters, CablesConfig } from './config';
import {
  CABLES_API_URL,
  CABLES_FIRM_QUOTE_TIMEOUT_MS,
  CABLES_GAS_COST,
  CABLES_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION,
} from './constants';
import { CablesRateFetcher } from './rate-fetcher';
import { CablesData, CablesRFQResponse } from './types';
import mainnetRFQAbi from '../../abi/cables/CablesMainnetRFQ.json';
import { Interface } from 'ethers/lib/utils';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { BI_MAX_UINT256 } from '../../bigint-constants';
import {
  SlippageCheckError,
  TooStrictSlippageCheckError,
} from '../generic-rfq/types';

export class Cables extends SimpleExchange implements IDex<any> {
  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(CablesConfig);
  private rateFetcher: CablesRateFetcher;
  logger: Logger;
  private tokensMap: { [address: string]: Token } = {};

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = CablesAdapters[network] || {}, // readonly routerAddress: string = HashflowConfig['Hashflow'][network] //   .routerAddress, // protected routerInterface = new Interface(routerAbi),
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
  async preProcessTransaction?(
    optimalSwapExchange: OptimalSwapExchange<CablesData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<CablesData>, ExchangeTxInfo]> {
    // if (await this.isBlacklisted(options.txOrigin)) {
    //   this.logger.warn(
    //     `${this.dexKey}-${this.network}: blacklisted TX Origin address '${options.txOrigin}' trying to build a transaction. Bailing...`,
    //   );
    //   throw new Error(
    //     `${this.dexKey}-${
    //       this.network
    //     }: user=${options.txOrigin.toLowerCase()} is blacklisted`,
    //   );
    // }

    if (BigInt(optimalSwapExchange.srcAmount) === 0n) {
      throw new Error('getFirmRate failed with srcAmount === 0');
    }

    // console.log('OPTIMAL SWAP EXCHANGE', srcToken, destToken, side, options);

    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);
    const swapIdentifier = `${this.dexKey}_${normalizedSrcToken.address}_${normalizedDestToken.address}_${side}`;

    try {
      const makerToken = normalizedDestToken;
      const takerToken = normalizedSrcToken;

      const isSell = side === SwapSide.SELL;
      const isBuy = side === SwapSide.BUY;

      const slippageBps = isSell
        ? BigNumber(1)
            .minus(options.slippageFactor)
            .multipliedBy(10000)
            .toFixed(0)
        : options.slippageFactor.minus(1).multipliedBy(10000).toFixed(0);

      // const rfqParams = {
      //   makerAsset: ethers.utils.getAddress(makerToken.address),
      //   takerAsset: ethers.utils.getAddress(takerToken.address),
      //   makerAmount: isBuy ? optimalSwapExchange.destAmount : undefined,
      //   takerAmount: isSell ? optimalSwapExchange.srcAmount : undefined,
      //   userAddress: options.txOrigin,
      //   chainid: this.network,
      //   executor: this.augustusAddress,
      //   partner: options.partner,
      //   slippage: slippageBps,
      // };

      const rfqParams = {
        makerAsset: ethers.utils.getAddress(makerToken.address),
        takerAsset: ethers.utils.getAddress(takerToken.address),
        ...(isBuy && { makerAmount: optimalSwapExchange.destAmount }),
        ...(isSell && { takerAmount: optimalSwapExchange.srcAmount }),
        userAddress: options.txOrigin,
        chainId: String(this.network),
      };

      console.log('RFQ PARAMS:', rfqParams);

      const rfq: CablesRFQResponse = await this.dexHelper.httpRequest.post(
        `${CABLES_API_URL}/quote`,
        rfqParams,
        CABLES_FIRM_QUOTE_TIMEOUT_MS,
        { 'x-apikey': 'TODO - API KEY' },
      );

      console.log('RFQ RESPONSE:', rfq);

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

      const slippageFactor = options.slippageFactor;
      let isFailOnSlippage = false;
      let slippageErrorMessage = '';

      /**
       * Slipage part 1
       */
      // if (isSell) {
      //   if (
      //     BigInt(order.makerAmount) <
      //     BigInt(
      //       new BigNumber(optimalSwapExchange.destAmount.toString())
      //         .times(slippageFactor)
      //         .toFixed(0),
      //     )
      //   ) {
      //     isFailOnSlippage = true;
      //     const message = `${this.dexKey}-${this.network}: too much slippage on quote ${side} quoteTokenAmount ${order.makerAmount} / destAmount ${optimalSwapExchange.destAmount} < ${slippageFactor}`;
      //     slippageErrorMessage = message;
      //     this.logger.warn(message);
      //   }
      // } else {
      //   if (
      //     BigInt(order.takerAmount) >
      //     BigInt(
      //       slippageFactor
      //         .times(optimalSwapExchange.srcAmount.toString())
      //         .toFixed(0),
      //     )
      //   ) {
      //     isFailOnSlippage = true;
      //     const message = `${this.dexKey}-${
      //       this.network
      //     }: too much slippage on quote ${side} baseTokenAmount ${
      //       order.takerAmount
      //     } / srcAmount ${
      //       optimalSwapExchange.srcAmount
      //     } > ${slippageFactor.toFixed()}`;
      //     slippageErrorMessage = message;
      //     this.logger.warn(message);
      //   }
      // }

      /**
       * Slippage part 2
       */
      let isTooStrictSlippage = false;
      if (
        isFailOnSlippage &&
        isSell &&
        new BigNumber(1)
          .minus(slippageFactor)
          .lt(CABLES_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION)
      ) {
        isTooStrictSlippage = true;
      } else if (
        isFailOnSlippage &&
        isBuy &&
        slippageFactor
          .minus(1)
          .lt(CABLES_MIN_SLIPPAGE_FACTOR_THRESHOLD_FOR_RESTRICTION)
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
            quoteData: order,
          },
        },
        { deadline: minDeadline },
      ];
    } catch (e) {
      throw e;
    }
  }
  getTokenFromAddress(address: Address): Token {
    return this.tokensMap[this.normalizeTokenAddress(address)];
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CablesData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const { quoteData } = data;

    assert(
      quoteData !== undefined,
      `${this.dexKey}-${this.network}: quoteData undefined`,
    );

    const swapFunction = 'simpleSwap';
    const swapFunctionParams = [
      [
        quoteData.nonceAndMeta,
        quoteData.expiry,
        quoteData.makerAsset,
        quoteData.takerAsset,
        quoteData.taker,
        quoteData.makerAmount,
        quoteData.takerAmount,
      ],
      quoteData.signature,
    ];

    const swapData = this.rfqInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      this.mainnetRFQAddress,
    );
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

    console.log('getDexParam arguments:', {
      srcToken: srcToken,
      destToken: destToken,
      srcAmount: srcAmount,
      destAmount: destAmount,
      recipient: recipient,
      data: data,
      side: side,
    });

    const swapFunction = 'simpleSwap';
    const swapFunctionParams = [
      [
        quoteData.nonceAndMeta,
        quoteData.expiry,
        quoteData.makerAsset,
        quoteData.takerAsset,
        quoteData.taker,
        quoteData.makerAmount,
        quoteData.takerAmount,
      ],
      quoteData.signature,
    ];

    console.log('swapFunctionParams', swapFunctionParams);

    const exchangeData = this.rfqInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return {
      exchangeData,
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: false,
      targetExchange: this.mainnetRFQAddress,
      returnAmountPos: undefined,
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
      address: this.normalizeTokenAddress(token.address),
    };
  }
  normalizeTokenAddress(address: Address): Address {
    return address.toLowerCase();
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
    if (!srcToken || !destToken) {
      return [];
    }
    const pairData = await this.getPairData(srcToken, destToken);
    console.log('pairData', pairData);
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

      // Ensure that "symbol" is set
      const tokens = await this.getCachedTokens();
      this.tokensMap = Object.keys(tokens).reduce((acc, key) => {
        //@ts-ignore
        acc[tokens[key].address.toLowerCase()] = tokens[key];
        return acc;
      }, {});

      for (const symbol of Object.keys(tokens)) {
        const normalizedTokenAddress = tokens[symbol].address.toLowerCase();

        if (normalizedSrcToken.address === normalizedTokenAddress) {
          normalizedSrcToken.symbol = tokens[symbol].symbol;
        }
        if (normalizedDestToken.address === normalizedTokenAddress) {
          normalizedDestToken.symbol = tokens[symbol].symbol;
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
      const prices = await this.getCachedPrices();
      // console.log('CACHED PRICES', prices);
      if (!prices) return null;

      let pairKey = `${normalizedSrcToken.symbol}/${normalizedDestToken.symbol}`;
      const pairsKeys = Object.keys(prices);

      if (!pairsKeys.includes(pairKey)) {
        // Revert
        pairKey = `${normalizedDestToken.symbol}/${normalizedSrcToken.symbol}`;
        if (!pairsKeys.includes(pairKey)) {
          return null;
        }
      }

      /**
       * Orderbook
       */
      const priceData = prices[pairKey];

      let orderbook: any[] = [];
      if (side === SwapSide.BUY) {
        orderbook = priceData.asks;
      } else {
        orderbook = priceData.bids;
      }
      if (orderbook?.length === 0) {
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
      const calculatedPrices = amounts.map(amount => {
        // TOB OF BOOK FOR NOW
        const price = (
          orderbook[0][0] *
          10 ** normalizedDestToken.decimals
        ).toFixed();
        return BigInt(price);
      });
      // console.log('CALCULATED PRICES', calculatedPrices);

      const outDecimals =
        side === SwapSide.BUY
          ? normalizedSrcToken.decimals
          : normalizedDestToken.decimals;
      const result = [
        {
          prices: calculatedPrices,
          unit: BigInt(outDecimals),
          exchange: this.dexKey,
          gasCost: CABLES_GAS_COST,
          orderPrice,
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

  // Function to find a key by address
  private findKeyByAddress = (
    jsonData: any,
    targetAddress: string,
  ): string | undefined => {
    for (const key in jsonData) {
      if (jsonData[key].address.toLowerCase() === targetAddress.toLowerCase()) {
        return key;
      }
    }
    return undefined; // Address not found
  };

  async getPairData(srcToken: Token, destToken: Token): Promise<any> {
    const normalizedSrcToken = this.normalizeToken(srcToken);
    const normalizedDestToken = this.normalizeToken(destToken);

    if (normalizedSrcToken.address === normalizedDestToken.address) {
      return null;
    }

    const cachedTokens = await this.getCachedTokens();
    console.log('Cables cachedTokens', cachedTokens);
    console.log(
      'Input tokens',
      normalizedSrcToken.address,
      normalizedDestToken.address,
    );

    normalizedSrcToken.symbol = this.findKeyByAddress(
      cachedTokens,
      normalizedSrcToken.address,
    );
    normalizedDestToken.symbol = this.findKeyByAddress(
      cachedTokens,
      normalizedDestToken.address,
    );
    console.log('Cables normalizedSrcToken.symbol', normalizedSrcToken.symbol);
    console.log(
      'Cables normalizedDestToken.symbol',
      normalizedDestToken.symbol,
    );

    const cachedPairs = await this.getCachedPairs();
    console.log('Cables cachedPairs', cachedPairs);

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
    console.log('Cables potentialPairs', potentialPairs);

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
