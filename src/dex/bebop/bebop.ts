import { assert, AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  PoolLiquidity,
  Logger,
  OptimalSwapExchange,
  PreprocessTransactionOptions,
  ExchangeTxInfo,
  NumberAsString,
  DexExchangeParam,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import {
  BebopData,
  BebopLevel,
  BebopPair,
  BebopPricingResponse,
  RoutingInstruction,
  TokenDataMap,
} from './types';
import settlementABI from '../../abi/bebop/BebopSettlement.abi.json';
import { SimpleExchange } from '../simple-exchange';
import { BebopConfig } from './config';
import { Interface } from 'ethers/lib/utils';
import { RateFetcher } from './rate-fetcher';
import {
  BEBOP_API_URL,
  BEBOP_AUTH_NAME,
  BEBOP_GAS_COST,
  BEBOP_INIT_TIMEOUT_MS,
  BEBOP_PRICES_CACHE_TTL,
  BEBOP_QUOTE_TIMEOUT_MS,
  BEBOP_TOKENS_CACHE_TTL,
  BEBOP_TOKENS_POLLING_INTERVAL_MS,
  BEBOP_WS_API_URL,
} from './constants';
import BigNumber from 'bignumber.js';
import { getBigNumberPow } from '../../bignumber-constants';
import { utils } from 'ethers';
import qs from 'qs';

export class Bebop extends SimpleExchange implements IDex<BebopData> {
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;
  readonly isStatePollingDex = true;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BebopConfig);

  private rateFetcher: RateFetcher;
  private tokensMap: TokenDataMap = {};

  private pricesCacheKey: string;
  private tokensCacheKey: string;
  private tokensAddrCacheKey: string;

  private bebopAuthToken: string;

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    readonly settlementAddress: string = BebopConfig['Bebop'][network]
      .settlementAddress,
    protected settlementInterface = new Interface(settlementABI),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.tokensCacheKey = `tokens`;
    this.pricesCacheKey = `prices`;
    this.tokensAddrCacheKey = `tokens_addr`;
    const token = this.dexHelper.config.data.bebopAuthToken;
    if (!token) {
      throw new Error('Bebop auth token is not set');
    }
    this.bebopAuthToken = token;

    this.rateFetcher = new RateFetcher(
      this.dexHelper,
      this.dexKey,
      this.network,
      this.logger,
      {
        rateConfig: {
          tokensIntervalMs: BEBOP_TOKENS_POLLING_INTERVAL_MS,
          pricesCacheKey: this.pricesCacheKey,
          pricesCacheTTLSecs: BEBOP_PRICES_CACHE_TTL,
          tokensCacheKey: this.tokensCacheKey,
          tokensAddrCacheKey: this.tokensAddrCacheKey,
          tokensCacheTTLSecs: BEBOP_TOKENS_CACHE_TTL,
          tokensReqParams: {
            url:
              BEBOP_API_URL +
              `/pmm/${BebopConfig['Bebop'][network].chainName}/v3/token-info`,
          },
          pricesReqParams: {
            url:
              BEBOP_WS_API_URL +
              `/pmm/${BebopConfig['Bebop'][network].chainName}/v3/pricing`,
            headers: {
              name: BEBOP_AUTH_NAME,
              authorization: this.bebopAuthToken,
            },
          },
        },
      },
    );
  }

  async initializePricing(blockNumber: number) {
    if (!this.dexHelper.config.isSlave) {
      this.rateFetcher.start();
      await sleep(BEBOP_INIT_TIMEOUT_MS);
    }
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  getPoolIdentifier(base: string, quote: string): string {
    const identifier = `${
      this.dexKey
    }_${base.toLowerCase()}_${quote.toLowerCase()}`;
    return identifier;
  }

  invertLevels(levels: BebopLevel[]): BebopLevel[] {
    return levels.map(([price, size]) => [1 / price, size * price]);
  }

  invertBook(book: BebopPair): BebopPair {
    return {
      bids: this.invertLevels(book.asks),
      asks: this.invertLevels(book.bids),
      last_update_ts: book.last_update_ts,
    };
  }

  // considers only swapside.sell
  async calculateInstructions(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
  ): Promise<RoutingInstruction[]> {
    const prices = await this.getCachedPrices();
    if (!prices) {
      throw new Error('No prices available');
    }
    const directBook =
      prices[
        `${srcToken.address.toLowerCase()}/${destToken.address.toLowerCase()}`
      ];
    if (directBook) {
      return [
        {
          pair: `${srcToken.address.toLowerCase()}/${destToken.address.toLowerCase()}`,
          side,
          book: directBook,
          targetQuote: side == SwapSide.BUY,
        },
      ];
    }

    const inverseBook =
      prices[
        `${destToken.address.toLowerCase()}/${srcToken.address.toLowerCase()}`
      ];
    if (inverseBook) {
      const invertedBook = this.invertBook(inverseBook);
      return [
        {
          pair: `${srcToken.address.toLowerCase()}/${destToken.address.toLowerCase()}`,
          side,
          book: invertedBook,
          targetQuote: side == SwapSide.BUY,
        },
      ];
    }

    for (const middleToken of BebopConfig['Bebop'][this.network].middleTokens) {
      const baseMiddle =
        prices[
          `${srcToken.address.toLowerCase()}/${middleToken.toLowerCase()}`
        ];
      const quoteMiddle =
        prices[
          `${destToken.address.toLowerCase()}/${middleToken.toLowerCase()}`
        ];
      if (baseMiddle && quoteMiddle) {
        if (side == SwapSide.SELL) {
          return [
            {
              pair: `${srcToken.address.toLowerCase()}/${middleToken.toLowerCase()}`,
              side: side,
              book: baseMiddle,
              targetQuote: false,
            },
            {
              pair: `${middleToken.toLowerCase()}/${destToken.address.toLowerCase()}`,
              side: side,
              book: this.invertBook(quoteMiddle),
              targetQuote: false,
            },
          ];
        } else {
          return [
            {
              pair: `${middleToken.toLowerCase()}/${destToken.address.toLowerCase()}`,
              side: side,
              book: this.invertBook(quoteMiddle),
              targetQuote: true,
            },
            {
              pair: `${srcToken.address.toLowerCase()}/${middleToken.toLowerCase()}`,
              side: side,
              book: baseMiddle,
              targetQuote: true,
            },
          ];
        }
      }
    }

    return [];
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
    if (
      (await this.calculateInstructions(srcToken, destToken, side)).length > 0
    ) {
      const identifier = this.getPoolIdentifier(
        srcToken.address,
        destToken.address,
      );
      return [identifier];
    }

    return [];
  }

  runInstruction(
    instruction: RoutingInstruction,
    amount: BigNumber,
  ): BigNumber {
    let accumulated = BigNumber(0);
    let output = BigNumber(0);
    let filled = false;
    for (const level of instruction.book.bids) {
      const [price, size] = level;
      const amountToAccumulate = instruction.targetQuote
        ? BigNumber(size).times(price)
        : BigNumber(size);
      const afterAccumulated = accumulated.plus(amountToAccumulate);
      if (afterAccumulated.lt(amount)) {
        accumulated = accumulated.plus(amountToAccumulate);
        const amountToAddToOutput = instruction.targetQuote
          ? BigNumber(size)
          : BigNumber(size).times(price);
        output = output.plus(amountToAddToOutput);
        if (accumulated.eq(amount)) {
          filled = true;
          break;
        }
      } else {
        const remaining = amount.minus(accumulated);
        output = output.plus(
          instruction.targetQuote
            ? remaining.div(price)
            : remaining.times(price),
        );
        filled = true;
        break;
      }
    }
    if (filled) {
      return output;
    } else {
      return BigNumber(0);
    }
  }

  calculateOutput(
    instructions: RoutingInstruction[],
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
  ): bigint[] {
    const outputs = [];
    const inputDecimals =
      side == SwapSide.SELL ? srcToken.decimals : destToken.decimals;
    const outputDecimals =
      side == SwapSide.SELL ? destToken.decimals : srcToken.decimals;

    for (const amount of amounts) {
      if (amount == 0n) {
        outputs.push(0n);
        continue;
      }
      const amountDecimals = BigNumber(amount.toString()).div(
        getBigNumberPow(inputDecimals),
      );
      let output: BigNumber = BigNumber(0);
      for (const instruction of instructions) {
        output = this.runInstruction(
          instruction,
          output.gt(0) ? output : amountDecimals,
        );
        if (output.eq(0)) {
          break;
        }
      }
      if (output.gt(0)) {
        outputs.push(
          BigInt(output.times(getBigNumberPow(outputDecimals)).toFixed(0)),
        );
      } else {
        outputs.push(0n);
      }
    }
    return outputs;
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
  ): Promise<null | ExchangePrices<BebopData>> {
    this.tokensMap = (await this.getCachedTokens()) || {};

    try {
      const pools =
        limitPools ??
        (await this.getPoolIdentifiers(srcToken, destToken, side, blockNumber));

      if (pools.length === 0) {
        return null;
      }

      const instructions = await this.calculateInstructions(
        srcToken,
        destToken,
        side,
      );

      if (!instructions) {
        return null;
      }

      const outputs = this.calculateOutput(
        instructions,
        srcToken,
        destToken,
        amounts,
        side,
      );

      // Up to 3bps deviation is expected in the output compared to the on-chain result
      // On SwapSide.Sell, outputs compared  to quoting are coming out: -0.1 bips -> USDC, -1 bips Alt -> Alt.
      // On SwapSide.Buy, outputs compared to quoteing are coming out: 0.1 bips -> USDC, 1-3 bips Alt -> Alt.

      const outDecimals = SwapSide.SELL
        ? destToken.decimals
        : srcToken.decimals;

      return [
        {
          prices: outputs,
          unit: BigInt(outDecimals),
          data: {},
          poolIdentifier: pools[0],
          exchange: this.dexKey,
          gasCost: BEBOP_GAS_COST,
          poolAddresses: [this.settlementAddress],
        },
      ];
    } catch (e: unknown) {
      this.logger.error(
        `Error_getPricesVolume ${srcToken.address || srcToken.symbol}, ${
          destToken.address || destToken.symbol
        }, ${side}:`,
        e,
      );
      return null;
    }
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<BebopData>): number | number[] {
    // This relies heavily on exact quote. Can we note use Bebop Data to find this? either via pools or the data itself?
    // This assumes that a single maker was used to fill this trade
    // "order":{
    return (
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      // "expiry":"1725541751"
      CALLDATA_GAS_COST.TIMESTAMP +
      // "taker_address":"0x9008d19f58aabd9ed0d60971565aa8510560ab41"
      CALLDATA_GAS_COST.ADDRESS +
      // "maker_address":"0x807cf9a772d5a3f9cefbc1192e939d62f0d9bd38"
      CALLDATA_GAS_COST.ADDRESS +
      // "maker_nonce":"1725541661402362944"
      CALLDATA_GAS_COST.UUID +
      // "taker_token":"0x3429d03c6f7521aec737a0bbf2e5ddcef2c3ae31"
      CALLDATA_GAS_COST.ADDRESS +
      // "maker_token":"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
      CALLDATA_GAS_COST.ADDRESS +
      // "taker_amount":"3789033775358849793876"
      CALLDATA_GAS_COST.AMOUNT +
      // "maker_amount":"199726023273987970"
      CALLDATA_GAS_COST.AMOUNT +
      // "receiver":"0x9008d19f58aabd9ed0d60971565aa8510560ab41"
      CALLDATA_GAS_COST.ADDRESS +
      // "packed_commands":"0"
      CALLDATA_GAS_COST.wordNonZeroBytes(4) +
      // "flags":"103712057072216206793253728668500811363805133225332165859664901734817333248000"
      CALLDATA_GAS_COST.FULL_WORD +
      // }
      // "makerSignature":{
      // "signatureBytes":"0x34e1fbda1d48296949f0a003d4194646ed750a4ccd408b52979f60c2e7332207190a91600a40396b25fd645422dde85bc0ff53f26b66202a985ac8b9da87b47e1c"
      CALLDATA_GAS_COST.FULL_WORD +
      // "flags":"1"
      CALLDATA_GAS_COST.LENGTH_SMALL +
      // }
      // "filledTakerAmount":"0"
      CALLDATA_GAS_COST.AMOUNT
    );
  }

  // Encode params required by the exchange adapter
  // V5: Used for multiSwap, buy & megaSwap
  // V6: Not used, can be left blank
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BebopData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { tx } = data;

    if (!tx) {
      throw new Error('No tx in data');
    }

    // Encode here the payload for adapter
    const payload = tx.data;

    return {
      targetExchange: this.settlementAddress,
      payload,
      networkFee: '0',
    };
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    const tokens = await this.getCachedTokens();

    if (tokens) {
      this.tokensMap = tokens;
    }
  }

  getMaxLiquidity(levels: BebopLevel[]) {
    return levels.reduce((acc, [price, size]) => {
      return acc + price * size;
    }, 0);
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const prices = await this.getCachedPrices();

    if (!prices) {
      return [];
    }

    const pools: PoolLiquidity[] = [];

    for (const [pair, pairData] of Object.entries(prices)) {
      let liquidityUSD = 0;
      let token;
      const [base, quote] = pair.split('/');
      if (base.toLowerCase() == tokenAddress.toLowerCase()) {
        const liquidityInQuote = this.getMaxLiquidity(pairData.bids);
        token = {
          address: quote,
          decimals: this.tokensMap[quote.toLowerCase()].decimals,
        };
        const quoteTokenUsd = await this.dexHelper.getTokenUSDPrice(
          token,
          BigInt(Math.round(liquidityInQuote)),
        );
        liquidityUSD = liquidityInQuote * quoteTokenUsd;
      } else if (quote.toLowerCase() == tokenAddress.toLowerCase()) {
        const liquidityInBase = this.getMaxLiquidity(pairData.asks);
        token = {
          address: base,
          decimals: this.tokensMap[base.toLowerCase()].decimals,
        };
        const baseTokenUsd = await this.dexHelper.getTokenUSDPrice(
          token,
          BigInt(Math.round(liquidityInBase)),
        );
        liquidityUSD = liquidityInBase * baseTokenUsd;
      }
      if (liquidityUSD) {
        if (pools.length === 0) {
          pools.push({
            exchange: this.dexKey,
            address: this.settlementAddress,
            connectorTokens: [
              {
                address: quote,
                decimals: this.tokensMap[quote.toLowerCase()].decimals,
                symbol: this.tokensMap[quote.toLowerCase()].ticker,
              },
            ],
            liquidityUSD,
          });
        } else {
          pools[0].liquidityUSD += liquidityUSD;
          pools[0].connectorTokens.push({
            address: quote,
            decimals: this.tokensMap[quote.toLowerCase()].decimals,
            symbol: this.tokensMap[quote.toLowerCase()].ticker,
          });
        }
      }
    }

    return pools
      .sort((a, b) => b.liquidityUSD - a.liquidityUSD)
      .slice(0, limit);
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: BebopData,
    side: SwapSide,
  ): DexExchangeParam {
    const { tx } = data;

    assert(tx !== undefined, `${this.dexKey}-${this.network}: tx undefined`);

    return {
      exchangeData: tx.data,
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: false,
      targetExchange: this.settlementAddress,
      returnAmountPos: undefined,
    };
  }

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<BebopData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<BebopData>, ExchangeTxInfo]> {
    const isSell = side === SwapSide.SELL;
    const isBuy = side === SwapSide.BUY;

    const params = {
      sell_tokens: utils.getAddress(srcToken.address),
      buy_tokens: utils.getAddress(destToken.address),
      sell_amounts: isSell ? optimalSwapExchange.srcAmount : undefined,
      buy_amounts: isBuy ? optimalSwapExchange.destAmount : undefined,
      taker_address: utils.getAddress(options.executionContractAddress),
      receiver_address: utils.getAddress(options.executionContractAddress),
      gasless: false,
      skip_validation: true,
      source: BEBOP_AUTH_NAME,
    };

    try {
      const response: BebopData = await this.dexHelper.httpRequest.get(
        `${BEBOP_API_URL}/pmm/${
          BebopConfig['Bebop'][this.network].chainName
        }/v3/quote?${qs.stringify(params)}`,
        BEBOP_QUOTE_TIMEOUT_MS,
        {
          'source-auth': this.bebopAuthToken,
        },
      );

      if (!response) {
        throw new Error('Failed to get quote');
      }

      if (
        !response.tx ||
        !response.buyTokens ||
        !response.sellTokens ||
        !response.expiry
      ) {
        throw new Error('Failed to get quote. No tx info');
      }

      if (side == SwapSide.SELL) {
        const requiredAmount = BigInt(optimalSwapExchange.destAmount);
        const quoteAmount = BigInt(
          response.buyTokens[utils.getAddress(destToken.address)].amount,
        );
        const requiredAmountWithSlippage = new BigNumber(
          requiredAmount.toString(),
        )
          .times(options.slippageFactor)
          .toFixed(0);
        if (quoteAmount < BigInt(requiredAmountWithSlippage)) {
          throw new Error(
            `Slipped, factor: ${quoteAmount.toString()} < ${requiredAmountWithSlippage}`,
          );
        }
      } else {
        const requiredAmount = BigInt(optimalSwapExchange.srcAmount);
        const quoteAmount = BigInt(
          response.sellTokens[utils.getAddress(srcToken.address)].amount,
        );
        const requiredAmountWithSlippage = new BigNumber(
          requiredAmount.toString(),
        )
          .times(options.slippageFactor)
          .toFixed(0);
        if (quoteAmount > BigInt(requiredAmountWithSlippage)) {
          throw new Error(
            `Slipped, factor: ${
              options.slippageFactor
            } ${quoteAmount.toString()} > ${requiredAmountWithSlippage}`,
          );
        }
      }
      return [
        {
          ...optimalSwapExchange,
          data: {
            ...response,
          },
        },
        { deadline: BigInt(response.expiry) },
      ];
    } catch (e) {
      const message = `${this.dexKey}-${this.network}: ${e}`;
      this.logger.error(message);
      throw new Error(message);
    }
  }

  async getCachedPrices(): Promise<BebopPricingResponse | null> {
    const cachedPrices = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.pricesCacheKey,
    );

    if (cachedPrices) {
      return JSON.parse(cachedPrices) as BebopPricingResponse;
    }

    return null;
  }

  async getCachedTokens(): Promise<TokenDataMap | null> {
    const cachedTokens = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      this.tokensAddrCacheKey,
    );

    if (cachedTokens) {
      return JSON.parse(cachedTokens) as TokenDataMap;
    }

    return null;
  }

  getTokenFromAddress(address: Address): Token {
    const bebopToken = this.tokensMap[address.toLowerCase()];
    return {
      address,
      decimals: bebopToken.decimals,
      symbol: bebopToken.ticker,
    };
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    if (!this.dexHelper.config.isSlave) {
      this.rateFetcher.stop();
    }
  }
}

const sleep = (time: number) =>
  new Promise(resolve => {
    setTimeout(resolve, time);
  });
