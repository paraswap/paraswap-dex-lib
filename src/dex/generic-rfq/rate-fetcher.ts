import BigNumber from 'bignumber.js';
import { info } from 'console';
import { ethers } from 'ethers';
import { SwapSide } from 'paraswap-core';
import { BN_0, BN_1 } from '../../bignumber-constants';
import { IDexHelper } from '../../dex-helper';
import { RequestConfig } from '../../dex-helper/irequest-wrapper';
import Fetcher from '../../lib/fetcher/fetcher';
import { getBalances } from '../../lib/tokens/balancer-fetcher';
import {
  AssetType,
  DEFAULT_ID_ERC20,
  DEFAULT_ID_ERC20_AS_STRING,
} from '../../lib/tokens/types';
import { Logger, Address, Token } from '../../types';
import { OrderInfo } from '../paraswap-limit-orders/types';
import { calculateOrderHash } from '../paraswap-limit-orders/utils';
import { authHttp } from './security';
import {
  AugustusOrderWithStringAndSignature,
  BlackListResponse,
  PairMap,
  PairsResponse,
  PriceAndAmount,
  PriceAndAmountBigNumber,
  RatesResponse,
  RFQConfig,
  RFQFirmRateResponse,
  RFQPayload,
  TokensResponse,
  TokenWithInfo,
} from './types';

export const reversePrice = (price: PriceAndAmountBigNumber) =>
  [
    BN_1.dividedBy(price[0]),
    price[1].times(price[0]),
  ] as PriceAndAmountBigNumber;

export class RateFetcher {
  private augustusAddress: Address;

  private tokensFetcher: Fetcher<TokensResponse>;
  private pairsFetcher: Fetcher<PairsResponse>;
  private rateFetcher: Fetcher<RatesResponse>;
  private blackListFetcher?: Fetcher<BlackListResponse>;

  private tokens: Record<string, TokenWithInfo> = {};
  private addressToTokenMap: Record<string, TokenWithInfo> = {};
  private pairs: PairMap = {};

  private firmRateAuth?: (options: RequestConfig) => void;

  private blackListCacheKey: string;

  constructor(
    private dexHelper: IDexHelper,
    private config: RFQConfig,
    private dexKey: string,
    private logger: Logger,
  ) {
    this.augustusAddress = dexHelper.config.data.augustusAddress.toLowerCase();

    this.tokensFetcher = new Fetcher<TokensResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.tokensConfig.reqParams,
          caster: this.castTokensResponse.bind(this),
          authenticate: authHttp(config.tokensConfig.secret),
        },
        handler: this.handleTokensResponse.bind(this),
      },
      config.tokensConfig.intervalMs,
      this.logger,
    );

    this.pairsFetcher = new Fetcher<PairsResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.pairsConfig.reqParams,
          caster: this.castPairs.bind(this),
          authenticate: authHttp(config.pairsConfig.secret),
        },
        handler: this.handlePairsResponse.bind(this),
      },
      config.pairsConfig.intervalMs,
      this.logger,
    );

    this.rateFetcher = new Fetcher<RatesResponse>(
      dexHelper.httpRequest,
      {
        info: {
          requestOptions: config.rateConfig.reqParams,
          caster: this.castRateResponse.bind(this),
          authenticate: authHttp(config.rateConfig.secret),
        },
        handler: this.handleRatesResponse.bind(this),
      },
      config.rateConfig.intervalMs,
      logger,
    );

    if (config.blacklistConfig) {
      this.blackListFetcher = new Fetcher<BlackListResponse>(
        dexHelper.httpRequest,
        {
          info: {
            requestOptions: config.blacklistConfig.reqParams,
            caster: this.casteBlacklistResponse.bind(this),
          },
          handler: this.handleBlackListResponse.bind(this),
        },
        config.blacklistConfig.intervalMs,
        logger,
      );
    }

    this.blackListCacheKey = `${this.dexHelper.config.data.network}_${this.dexKey}_blacklist`;
    if (this.config.firmRateConfig.secret) {
      this.firmRateAuth = authHttp(this.config.firmRateConfig.secret);
    }
  }

  start() {
    this.tokensFetcher.startPolling();
    this.pairsFetcher.startPolling();
    if (this.blackListFetcher) {
      this.blackListFetcher.startPolling();
    }
  }

  stop() {
    this.tokensFetcher.stopPolling();
    this.pairsFetcher.stopPolling();
    this.rateFetcher.stopPolling();

    if (this.blackListFetcher) {
      this.blackListFetcher.stopPolling();
    }
  }

  private castTokensResponse(data: unknown): TokensResponse | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const parsed = data as TokensResponse;
    if (!parsed.tokens) {
      return null;
    }

    return parsed;
  }

  private handleTokensResponse(data: TokensResponse) {
    for (const tokenName of Object.keys(data.tokens)) {
      const token = data.tokens[tokenName];
      token.address = token.address.toLowerCase();
      this.tokens[tokenName] = token;
    }

    this.addressToTokenMap = Object.keys(this.tokens).reduce((acc, key) => {
      const obj = this.tokens[key];
      if (!obj) {
        return acc;
      }
      acc[obj.address.toLowerCase()] = obj;
      return acc;
    }, {} as Record<string, TokenWithInfo>);
  }

  private castPairs(data: unknown): PairsResponse | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const parsed = data as PairsResponse;
    if (!parsed.pairs) {
      return null;
    }
    return parsed;
  }

  private castRateResponse(data: unknown): RatesResponse | null {
    if (!data) {
      return null;
    }

    return data as RatesResponse;
  }

  private handlePairsResponse(resp: PairsResponse) {
    this.pairs = {};

    if (this.rateFetcher.isPolling()) {
      this.rateFetcher.stopPolling();
    }

    const pairs: PairMap = {};
    for (const pairName of Object.keys(resp.pairs)) {
      pairs[pairName] = resp.pairs[pairName];
    }

    this.pairs = pairs;
    this.rateFetcher.startPolling();
  }

  private casteBlacklistResponse(data: unknown): BlackListResponse | null {
    if (!data) {
      return null;
    }

    const parsed = data as BlackListResponse;
    if (!parsed.blacklist) {
      return null;
    }

    return parsed;
  }

  private handleBlackListResponse(resp: BlackListResponse) {
    for (const address of resp.blacklist) {
      this.dexHelper.cache.sadd(this.blackListCacheKey, address.toLowerCase());
    }
  }

  public isBlackListed(userAddress: string) {
    return this.dexHelper.cache.sismember(
      this.blackListCacheKey,
      userAddress.toLowerCase(),
    );
  }

  private handleRatesResponse(resp: RatesResponse) {
    const pairs = this.pairs;
    for (const pairName of Object.keys(resp)) {
      const pair = pairs[pairName];
      if (!pair) {
        continue;
      }
      const prices = resp[pairName];

      const baseToken = this.tokens[pair.base];
      const quoteToken = this.tokens[pair.quote];

      if (!baseToken || !quoteToken) {
        this.logger.warn(`missing base or quote token`);
        continue;
      }

      if (prices.bids.length) {
        this.dexHelper.cache.setex(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${baseToken.address}_${quoteToken.address}_bids`,
          this.config.rateConfig.dataTTLS,
          JSON.stringify(prices.bids),
        );
      }

      if (prices.asks.length) {
        this.dexHelper.cache.setex(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${baseToken.address}_${quoteToken.address}_asks`,
          this.config.rateConfig.dataTTLS,
          JSON.stringify(prices.asks),
        );
      }
    }
  }

  checkHealth(): boolean {
    return [this.tokensFetcher, this.rateFetcher].some(
      f => f.lastFetchSucceeded,
    );
  }

  public getPairsLiqudity(tokenAddress: string) {
    const token = this.addressToTokenMap[tokenAddress];

    const pairNames = Object.keys(this.pairs);
    const pairs = Object.values(this.pairs);

    return pairs
      .filter((p, index) => pairNames[index].includes(token.symbol!))
      .map(p => {
        const baseToken = this.tokens[p.base];
        const quoteToken = this.tokens[p.quote];
        let connectorToken: Token | undefined;
        if (baseToken.address !== tokenAddress) {
          connectorToken = {
            address: baseToken.address,
            decimals: baseToken.decimals,
          };
        } else {
          connectorToken = {
            address: quoteToken.address,
            decimals: quoteToken.decimals,
          };
        }
        return {
          connectorTokens: [connectorToken],
          liquidityUSD: p.liquidityUSD,
        };
      });
  }

  public async getOrderPrice(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
  ): Promise<PriceAndAmountBigNumber[] | null> {
    let reversed = false;

    let pricesAsString: string | null = null;
    if (side === SwapSide.SELL) {
      pricesAsString = await this.dexHelper.cache.get(
        this.dexKey,
        this.dexHelper.config.data.network,
        `${srcToken.address}_${destToken.address}_bids`,
      );

      if (!pricesAsString) {
        pricesAsString = await this.dexHelper.cache.get(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${destToken.address}_${srcToken.address}_asks`,
        );
        reversed = true;
      }
    } else {
      pricesAsString = await this.dexHelper.cache.get(
        this.dexKey,
        this.dexHelper.config.data.network,
        `${destToken.address}_${srcToken.address}_asks`,
      );

      if (!pricesAsString) {
        pricesAsString = await this.dexHelper.cache.get(
          this.dexKey,
          this.dexHelper.config.data.network,
          `${srcToken.address}_${destToken.address}_bids`,
        );
        reversed = true;
      }
    }

    if (!pricesAsString) {
      return null;
    }

    const orderPricesAsString: PriceAndAmount[] = JSON.parse(pricesAsString);
    if (!orderPricesAsString) {
      return null;
    }

    let orderPrices = orderPricesAsString.map(price => [
      new BigNumber(price[0]),
      new BigNumber(price[1]),
    ]);

    if (reversed) {
      orderPrices = orderPrices.map(price =>
        reversePrice(price as PriceAndAmountBigNumber),
      );
    }

    return orderPrices as PriceAndAmountBigNumber[];
  }

  private async getPayload(
    srcToken: Token,
    destToken: Token,
    amount: string,
    side: SwapSide,
    txOrigin: Address,
  ) {
    let orderPrices: PriceAndAmountBigNumber[] | null = null;
    try {
      orderPrices = await this.getOrderPrice(srcToken, destToken, side);
      if (!orderPrices) {
        return {
          value: BN_0,
        };
      }
    } catch (e) {
      this.logger.error(e);
      return { error: e };
    }
    if (!orderPrices) {
      return null;
    }

    const payload: RFQPayload = {
      makerAsset: destToken.address,
      takerAsset: srcToken.address,
      model: 'firm',
      makerAmount: side === SwapSide.BUY ? amount : undefined,
      takerAmount: side === SwapSide.SELL ? amount : undefined,
      taker: this.augustusAddress,
      txOrigin,
    };

    return {
      payload,
    };
  }

  private buildOrderHash(order: AugustusOrderWithStringAndSignature): string {
    return calculateOrderHash(
      this.dexHelper.config.data.network,
      order,
      this.dexHelper.config.data.augustusRFQAddress,
    );
  }

  private async checkOrder(order: AugustusOrderWithStringAndSignature) {
    const balances = await getBalances(this.dexHelper.multiWrapper, [
      {
        owner: order.maker,
        asset: order.makerAsset,
        assetType: AssetType.ERC20,
        ids: [
          {
            id: DEFAULT_ID_ERC20,
            spenders: [this.dexHelper.config.data.augustusRFQAddress],
          },
        ],
      },
    ]);

    const balance = balances[0];

    const makerAmountBigInt = BigInt(order.makerAmount);
    const makerBalance = BigInt(balance.amounts[DEFAULT_ID_ERC20_AS_STRING]);
    if (makerBalance <= makerAmountBigInt) {
      throw new Error(
        `maker does not have enough balance (request ${makerAmountBigInt} value ${makerBalance}`,
      );
    }

    const takerBalance = BigInt(
      balance.allowances[DEFAULT_ID_ERC20_AS_STRING][
        this.dexHelper.config.data.augustusRFQAddress
      ],
    );
    if (takerBalance <= makerAmountBigInt) {
      throw new Error(
        `maker does not have enough allowance (request ${makerAmountBigInt} value ${takerBalance}`,
      );
    }

    const hash = this.buildOrderHash(order);

    const recovered = ethers.utils
      .recoverAddress(hash, order.signature)
      .toLowerCase();

    if (recovered !== order.maker.toLowerCase()) {
      throw new Error(`signature is invalid`);
    }
  }

  async getFirmRate(
    _srcToken: Token,
    _destToken: Token,
    srcAmount: string,
    side: SwapSide,
    txOrigin: Address,
  ): Promise<OrderInfo> {
    const srcToken = this.dexHelper.config.wrapETH(_srcToken);
    const destToken = this.dexHelper.config.wrapETH(_destToken);

    if (BigInt(srcAmount) === 0n) {
      throw new Error('getFirmRate failed with srcAmount == 0');
    }

    const result = await this.getPayload(
      srcToken,
      destToken,
      srcAmount,
      side,
      txOrigin,
    );

    if (!result) {
      this.logger.error(`getPayload failed with empty payload`);
      throw new Error('getFirmRate failed with empty payload');
    }

    if (result.error) {
      this.logger.error(`getPayload failed with error: `, result.error);
      throw new Error('getFirmRate failed no payload');
    }

    if (!result.payload) {
      this.logger.error(`No payload ${JSON.stringify(result)}`);
      throw new Error('getFirmRate failed no payload');
    }

    try {
      let payload = {
        data: result.payload,
        ...this.config.firmRateConfig,
      };

      if (this.firmRateAuth) {
        this.firmRateAuth(payload);
        delete payload.secret;
      }

      const { data } =
        await this.dexHelper.httpRequest.request<RFQFirmRateResponse>(payload);

      if (data.status === 'rejected') {
        this.logger.warn(
          `getFirmRate failed ${JSON.stringify(
            result,
          )}, result:${JSON.stringify(data)}`,
        );
        throw new Error('getFirmRate rejected');
      }

      await this.checkOrder(data.order);

      return {
        order: {
          maker: data.order.maker,
          taker: data.order.taker,
          expiry: data.order.expiry,
          nonceAndMeta: data.order.nonceAndMeta,
          makerAsset: data.order.makerAsset,
          takerAsset: data.order.takerAsset,
          makerAmount: data.order.makerAmount,
          takerAmount: data.order.takerAmount,
        },
        signature: data.order.signature,
        takerTokenFillAmount: data.order.takerAmount,
        permitMakerAsset: '0x',
        permitTakerAsset: '0x',
      };
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }
}
