import BigNumber from 'bignumber.js';
import {
  Token,
  ExchangePrices,
  ExchangeTxInfo,
  PreprocessTransactionOptions,
  Config,
} from '../../types';
import { Network, SwapSide } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { ParaSwapLimitOrders } from '../paraswap-limit-orders/paraswap-limit-orders';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import { ParaSwapLimitOrdersData } from '../paraswap-limit-orders/types';
import { ONE_ORDER_GASCOST } from '../paraswap-limit-orders/constant';
import { RateFetcher } from './rate-fetcher';
import { RFQConfig } from './types';
import { OptimalSwapExchange } from 'paraswap-core';
import { BI_MAX_UINT256 } from '../../bigint-constants';

type OutputsResults = {
  outputs: bigint[];
  ordersCount: number;
};

export class GenericRFQ extends ParaSwapLimitOrders {
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
    protected dexKey: string,
    protected dexHelper: IDexHelper,
    config: RFQConfig,
  ) {
    super(network, dexKey, dexHelper);
    this.rateFetcher = new RateFetcher(dexHelper, config, dexKey, this.logger);
  }

  initializePricing(blockNumber: number): void {
    //TODO: only master version
    this.rateFetcher.start();
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
    amountsWithRates: [BigNumber, BigNumber][],
  ): OutputsResults {
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
          const [srcAmount, rate] = amountsWithRates[lastOrderIndex];
          if (srcAmountLeft.gt(srcAmount)) {
            const destAmount = srcAmount.multipliedBy(rate);

            srcAmountLeft = srcAmountLeft.minus(srcAmount);
            destAmountFilled = destAmountFilled.plus(destAmount);

            lastTotalSrcAmount = lastTotalSrcAmount.plus(srcAmount);
            lastTotalDestAmount = lastTotalDestAmount.plus(destAmount);
            lastOrderIndex++;
          } else {
            destAmountFilled = destAmountFilled.plus(
              srcAmountLeft.multipliedBy(rate),
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

    return {
      outputs: outputs.map(o =>
        BigInt(o.multipliedBy(outMultiplier).toFixed(0)),
      ),
      ordersCount: lastOrderIndex,
    };
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

    const _srcAddress = _srcToken.address.toLowerCase();
    const _destAddress = _destToken.address.toLowerCase();
    if (_srcAddress === _destAddress) return null;

    const expectedIdentifier = this.getIdentifier(_srcAddress, _destAddress);

    const orderPricesInfo = await this.rateFetcher.getOrderPrice(
      _srcToken,
      _destToken,
      side,
    );
    if (!orderPricesInfo) {
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
      orderPricesInfo.rates,
    );

    const unit = unitResults.outputs[0];

    const outputs = this.calcOutsFromAmounts(
      _amountsInBN,
      getBigNumberPow(outDecimals),
      orderPricesInfo.rates,
    );
    return [
      {
        gasCost: Number(BigInt(outputs.ordersCount) * ONE_ORDER_GASCOST),
        exchange: this.dexKey,
        poolIdentifier: expectedIdentifier,
        prices: outputs.outputs,
        unit,
        data: {
          orderInfos: null,
        },
        poolAddresses: [this.augustusRFQAddress],
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
      isSell ? optimalSwapExchange.srcAmount : optimalSwapExchange.destAmount,
      side,
      options.txOrigin,
    );

    const expiryAsBigInt = BigInt(order.order.expiry);
    const minDeadline = expiryAsBigInt > 0 ? expiryAsBigInt : BI_MAX_UINT256;

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
}
