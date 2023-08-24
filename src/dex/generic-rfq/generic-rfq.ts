import BigNumber from 'bignumber.js';
import {
  Token,
  ExchangePrices,
  ExchangeTxInfo,
  PreprocessTransactionOptions,
  Config,
  PoolLiquidity,
} from '../../types';
import { Network, SwapSide } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { ParaSwapLimitOrders } from '../paraswap-limit-orders/paraswap-limit-orders';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import { ParaSwapLimitOrdersData } from '../paraswap-limit-orders/types';
import { ONE_ORDER_GASCOST } from '../paraswap-limit-orders/constant';
import { RateFetcher } from './rate-fetcher';
import {
  PriceAndAmountBigNumber,
  RFQConfig,
  SlippageCheckError,
} from './types';
import { OptimalSwapExchange } from '@paraswap/core';
import { BI_MAX_UINT256 } from '../../bigint-constants';

export const OVERORDER_BPS = 100;
export const BPS_MAX_VALUE = 10000n;

export const overOrder = (amount: string, bps: number) =>
  ((BigInt(amount) * (BPS_MAX_VALUE + BigInt(bps))) / BPS_MAX_VALUE).toString();

export class GenericRFQ extends ParaSwapLimitOrders {
  readonly isStatePollingDex = true;
  private rateFetcher: RateFetcher;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] = [];

  static builderDexKeysWithNetwork(config: Config): void {
    Object.keys(config.rfqConfigs).forEach(rfqName =>
      this.dexKeysWithNetwork.push({
        key: rfqName,
        networks: [config.network],
      }),
    );
  }

  constructor(
    protected network: Network,
    dexKey: string,
    protected dexHelper: IDexHelper,
    private config: RFQConfig,
  ) {
    super(network, dexKey, dexHelper);
    this.rateFetcher = new RateFetcher(dexHelper, config, dexKey, this.logger);
  }

  async initializePricing(blockNumber: number): Promise<void> {
    await this.rateFetcher.initialize();
    if (!this.dexHelper.config.isSlave) {
      this.rateFetcher.start();
    }
    return;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);
    return [
      `${this.dexKey}_${_srcToken.address}_${_destToken.address}`.toLowerCase(),
    ];
  }

  calcOutsFromAmounts(
    amounts: BigNumber[],
    outMultiplier: BigNumber,
    amountsWithRates: PriceAndAmountBigNumber[],
  ): bigint[] {
    let lastOrderIndex = 0;
    let lastTotalSrcAmount = BN_0;
    let lastTotalDestAmount = BN_0;
    const outputs = new Array<BigNumber>(amounts.length).fill(BN_0);
    for (const [i, amount] of amounts.entries()) {
      if (amount.isZero()) {
        outputs[i] = BN_0;
      } else {
        let srcAmountLeft = amount.minus(lastTotalSrcAmount);
        let destAmountFilled = lastTotalDestAmount;
        while (lastOrderIndex < amountsWithRates.length) {
          const [price, amount] = amountsWithRates[lastOrderIndex];
          if (srcAmountLeft.gt(amount)) {
            const destAmount = amount.multipliedBy(price);

            srcAmountLeft = srcAmountLeft.minus(amount);
            destAmountFilled = destAmountFilled.plus(destAmount);

            lastTotalSrcAmount = lastTotalSrcAmount.plus(amount);
            lastTotalDestAmount = lastTotalDestAmount.plus(destAmount);
            lastOrderIndex++;
          } else {
            destAmountFilled = destAmountFilled.plus(
              srcAmountLeft.multipliedBy(price),
            );
            srcAmountLeft = BN_0;
            break;
          }
        }
        if (srcAmountLeft.isZero()) {
          outputs[i] = destAmountFilled;
        } else {
          // If current amount was unfillable, then bigger amounts are unfillable as well
          break;
        }
      }
    }

    return outputs.map(o => BigInt(o.multipliedBy(outMultiplier).toFixed(0)));
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<ExchangePrices<ParaSwapLimitOrdersData> | null> {
    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    _srcToken.address = _srcToken.address.toLowerCase();
    _destToken.address = _destToken.address.toLowerCase();
    if (_srcToken.address === _destToken.address) return null;

    const expectedIdentifier = this.getIdentifier(
      _srcToken.address,
      _destToken.address,
    );

    if (!limitPools?.includes(expectedIdentifier)) {
      return null;
    }

    const rates = await this.rateFetcher.getOrderPrice(
      _srcToken,
      _destToken,
      side,
    );
    if (!rates) {
      return null;
    }

    const inDecimals =
      side === SwapSide.SELL ? _srcToken.decimals : _destToken.decimals;
    const outDecimals =
      side === SwapSide.SELL ? _destToken.decimals : _srcToken.decimals;

    const _amountsInBN = amounts.map(a =>
      new BigNumber(a.toString()).dividedBy(getBigNumberPow(inDecimals)),
    );

    const unitVolume = BN_1;

    const unitResults = this.calcOutsFromAmounts(
      [unitVolume],
      getBigNumberPow(outDecimals),
      rates,
    );

    const unit = unitResults[0];
    const outputs = this.calcOutsFromAmounts(
      _amountsInBN,
      getBigNumberPow(outDecimals),
      rates,
    );
    return [
      {
        gasCost: Number(ONE_ORDER_GASCOST),
        exchange: this.dexKey,
        poolIdentifier: expectedIdentifier,
        prices: outputs,
        unit,
        data: {
          orderInfos: null,
        },
      },
    ];
  }

  async preProcessTransaction?(
    optimalSwapExchange: OptimalSwapExchange<ParaSwapLimitOrdersData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<ParaSwapLimitOrdersData>, ExchangeTxInfo]> {
    const isSell = side === SwapSide.SELL;

    const order = await this.rateFetcher.getFirmRate(
      srcToken,
      destToken,
      isSell
        ? overOrder(optimalSwapExchange.srcAmount, OVERORDER_BPS)
        : overOrder(optimalSwapExchange.destAmount, 1),
      side,
      options.txOrigin,
      options.partner,
    );

    const expiryAsBigInt = BigInt(order.order.expiry);
    const minDeadline = expiryAsBigInt > 0 ? expiryAsBigInt : BI_MAX_UINT256;

    const makerAssetAmount = BigInt(order.order.makerAmount);
    const takerAssetAmount = BigInt(order.order.takerAmount);

    const srcAmount = BigInt(optimalSwapExchange.srcAmount);
    const destAmount = BigInt(optimalSwapExchange.destAmount);

    const slippageFactor = options.slippageFactor;

    if (side === SwapSide.SELL) {
      const makerAssetAmountFilled =
        takerAssetAmount > srcAmount
          ? (makerAssetAmount * srcAmount) / takerAssetAmount
          : makerAssetAmount;

      if (
        makerAssetAmountFilled <
        BigInt(
          new BigNumber(destAmount.toString()).times(slippageFactor).toFixed(0),
        )
      ) {
        const message = `${this.dexKey}: too much slippage on quote ${side} makerAssetAmountFilled ${makerAssetAmountFilled} / destAmount ${destAmount} < ${slippageFactor}`;
        this.logger.warn(message);
        throw new SlippageCheckError(message);
      }
    } else {
      if (makerAssetAmount < destAmount) {
        // Won't receive enough assets
        const message = `${this.dexKey}: too much slippage on quote ${side}  makerAssetAmount ${makerAssetAmount} < destAmount ${destAmount}`;
        this.logger.warn(message);
        throw new SlippageCheckError(message);
      } else {
        if (
          takerAssetAmount >
          BigInt(slippageFactor.times(srcAmount.toString()).toFixed(0))
        ) {
          const message = `${
            this.dexKey
          }: too much slippage on quote ${side} takerAssetAmount ${takerAssetAmount} / srcAmount ${srcAmount} > ${slippageFactor.toFixed()}`;
          this.logger.warn(message);
          throw new SlippageCheckError(message);
        }
      }
    }

    return [
      {
        ...optimalSwapExchange,
        data: {
          orderInfos: [order],
        },
      },
      {
        deadline: minDeadline,
      },
    ];
  }

  async getTopPoolsForToken(
    tokenAddress: string,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const pairs = this.rateFetcher.getPairsLiquidity(
      tokenAddress.toLowerCase(),
    );

    return pairs.map(pair => ({
      exchange: this.dexKey,
      address: this.config.maker,
      connectorTokens: pair.connectorTokens,
      liquidityUSD: pair.liquidityUSD,
    }));
  }

  async isBlacklisted(userAddress: string): Promise<boolean> {
    return this.rateFetcher.isBlackListed(userAddress);
  }

  async setBlacklist(userAddress: string): Promise<boolean> {
    await this.dexHelper.cache.hset(
      this.rateFetcher.blackListCacheKey,
      userAddress.toLowerCase(),
      'true',
    );
    return true;
  }

  releaseResources(): void {
    if (this.rateFetcher) {
      this.rateFetcher.stop();
    }
  }
}
