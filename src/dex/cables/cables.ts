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
import { CablesData } from './types';

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
            url: '',
            // headers?: RequestHeaders;
            // params?: any;
          },
          pricesReqParams: {
            url: '',
            // headers?: RequestHeaders;
            // params?: any;
          },
          blacklistReqParams: {
            url: '',
            // headers?: RequestHeaders;
            // params?: any;
          },
          pairsIntervalMs: 1000,
          pricesIntervalMs: 1000,
          blacklistIntervalMs: 30_000,
          pairsCacheKey: 'cablesPairsCacheKey',
          pricesCacheKey: 'cablesPricesCacheKey',
          tokensAddrCacheKey: 'cablesTokensAddrCacheKey',
          tokensCacheKey: 'cablesTokensCacheKey',
          blacklistCacheKey: 'cablesBlacklistCacheKey',
          blacklistCacheTTLSecs: 60,
          pairsCacheTTLSecs: 2,
          pricesCacheTTLSecs: 2,
          tokensCacheTTLSecs: 2,
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
  getPoolIdentifier(srcAddress: Address, destAddress: Address, mm: string) {
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

  getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
    transferFees?: TransferFeeParams,
    isFirstSwap?: boolean,
  ): Promise<ExchangePrices<CablesData> | null> {
    throw new Error('Method not implemented.');
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
  //
}
