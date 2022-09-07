import { _require } from '../../../utils';
import { PoolState } from '../types';
import { exchangeRates } from './ExchangeRates';
import { exchangeRatesWithDexPricing } from './ExchangeRatesWithDexPricing';
import { SafeDecimalMath } from './SafeDecimalMath';

export class SynthetixMath {
  getAmountsForAtomicExchange(
    state: PoolState,
    sourceAmount: bigint,
    sourceCurrencyKey: string,
    destinationCurrencyKey: string,
  ) {
    const [amountReceived] = this._getAmountsForAtomicExchangeMinusFees(
      state,
      sourceAmount,
      sourceCurrencyKey,
      destinationCurrencyKey,
    );
    return amountReceived;
  }

  getAmountsForExchange(
    state: PoolState,
    sourceAmount: bigint,
    sourceCurrencyKey: string,
    destinationCurrencyKey: string,
  ) {
    const [exchangeFeeRate, tooVolatile] = this._feeRateForExchange(
      state,
      sourceCurrencyKey,
      destinationCurrencyKey,
    );

    // check rates volatility result
    _require(
      !tooVolatile,
      'exchange rates too volatile',
      { sourceAmount, sourceCurrencyKey, destinationCurrencyKey, tooVolatile },
      '!tooVolatile',
    );

    const destinationAmount = exchangeRates.effectiveValueAndRates(
      state,
      sourceCurrencyKey,
      sourceAmount,
      destinationCurrencyKey,
    );

    return this._deductFeesFromAmount(destinationAmount, exchangeFeeRate);
  }

  private _feeRateForExchange(
    state: PoolState,
    sourceCurrencyKey: string,
    destinationCurrencyKey: string,
  ): [bigint, boolean] {
    // Get the exchange fee rate as per the source currencyKey and destination currencyKey
    const baseRate =
      this._getExchangeFeeRate(state, sourceCurrencyKey) +
      this._getExchangeFeeRate(state, destinationCurrencyKey);

    const [dynamicFee, tooVolatile] = this._dynamicFeeRateForExchange(
      state,
      sourceCurrencyKey,
      destinationCurrencyKey,
    );
    return [baseRate + dynamicFee, tooVolatile];
  }

  private _dynamicFeeRateForExchange(
    state: PoolState,
    sourceCurrencyKey: string,
    destinationCurrencyKey: string,
  ): [bigint, boolean] {
    const [dynamicFeeDst, dstVolatile] = this._dynamicFeeRateForCurrency(
      state,
      destinationCurrencyKey,
    );
    const [dynamicFeeSrc, srcVolatile] = this._dynamicFeeRateForCurrency(
      state,
      sourceCurrencyKey,
    );
    let dynamicFee = dynamicFeeDst + dynamicFeeSrc;
    // cap to maxFee
    const overMax = dynamicFee > state.exchangeDynamicFeeConfig.maxFee;
    dynamicFee = overMax ? state.exchangeDynamicFeeConfig.maxFee : dynamicFee;
    return [dynamicFee, overMax || dstVolatile || srcVolatile];
  }

  private _dynamicFeeRateForCurrency(
    state: PoolState,
    currencyKey: string,
  ): [bigint, boolean] {
    // no dynamic dynamicFee for sUSD or too few rounds
    if (
      currencyKey === state.sUSDCurrencyKey ||
      state.exchangeDynamicFeeConfig.rounds <= 1
    ) {
      return [0n, false];
    }
    const roundId = exchangeRates.getCurrentRoundId(state, currencyKey);
    return this._dynamicFeeRateForCurrencyRound(state, currencyKey, roundId);
  }

  private _dynamicFeeRateForCurrencyRound(
    state: PoolState,
    currencyKey: string,
    roundId: bigint,
  ): [bigint, boolean] {
    // no dynamic dynamicFee for sUSD or too few rounds
    if (
      currencyKey == state.sUSDCurrencyKey ||
      state.exchangeDynamicFeeConfig.rounds <= 1
    ) {
      return [0n, false];
    }
    const [prices] = exchangeRates.ratesAndUpdatedTimeForCurrencyLastNRounds(
      state,
      currencyKey,
      state.exchangeDynamicFeeConfig.rounds,
      roundId,
    );
    let dynamicFee = this._dynamicFeeCalculation(
      prices,
      state.exchangeDynamicFeeConfig.threshold,
      state.exchangeDynamicFeeConfig.weightDecay,
    );
    // cap to maxFee
    const overMax = dynamicFee > state.exchangeDynamicFeeConfig.maxFee;
    dynamicFee = overMax ? state.exchangeDynamicFeeConfig.maxFee : dynamicFee;
    return [dynamicFee, overMax];
  }

  private _dynamicFeeCalculation(
    prices: bigint[],
    threshold: bigint,
    weightDecay: bigint,
  ): bigint {
    // don't underflow
    if (prices.length == 0) {
      return 0n;
    }

    let dynamicFee = 0n; // start with 0
    // go backwards in price array
    for (let i = prices.length - 1; i > 0; i--) {
      // apply decay from previous round (will be 0 for first round)
      dynamicFee = SafeDecimalMath.multiplyDecimal(dynamicFee, weightDecay);
      // calculate price deviation
      const deviation = this._thresholdedAbsDeviationRatio(
        prices[i - 1],
        prices[i],
        threshold,
      );
      // add to total fee
      dynamicFee = dynamicFee + deviation;
    }
    return dynamicFee;
  }

  private _thresholdedAbsDeviationRatio(
    price: bigint,
    previousPrice: bigint,
    threshold: bigint,
  ): bigint {
    if (previousPrice === 0n) {
      return 0n; // don't divide by zero
    }
    // abs difference between prices
    const absDelta =
      price > previousPrice ? price - previousPrice : previousPrice - price;
    // relative to previous price
    const deviationRatio = SafeDecimalMath.divideDecimal(
      absDelta,
      previousPrice,
    );
    // only the positive difference from threshold
    return deviationRatio > threshold ? deviationRatio - threshold : 0n;
  }

  private _getAmountsForAtomicExchangeMinusFees(
    state: PoolState,
    sourceAmount: bigint,
    sourceCurrencyKey: string,
    destinationCurrencyKey: string,
  ): [bigint, bigint, bigint, bigint, bigint, bigint] {
    let amountReceived = 0n;
    let fee = 0n;
    let exchangeFeeRate = 0n;

    let [
      destinationAmount,
      systemConvertedAmount,
      systemSourceRate,
      systemDestinationRate,
    ] = exchangeRatesWithDexPricing.effectiveAtomicValueAndRates(
      state,
      sourceCurrencyKey,
      sourceAmount,
      destinationCurrencyKey,
    );

    exchangeFeeRate = this._feeRateForAtomicExchange(
      state,
      sourceCurrencyKey,
      destinationCurrencyKey,
    );
    amountReceived = this._deductFeesFromAmount(
      destinationAmount,
      exchangeFeeRate,
    );
    fee = destinationAmount - amountReceived;

    return [
      amountReceived,
      fee,
      exchangeFeeRate,
      systemConvertedAmount,
      systemSourceRate,
      systemDestinationRate,
    ];
  }

  private _feeRateForAtomicExchange(
    state: PoolState,
    sourceCurrencyKey: string,
    destinationCurrencyKey: string,
  ): bigint {
    let baseRate =
      this._getAtomicExchangeFeeRate(state, sourceCurrencyKey) +
      this._getAtomicExchangeFeeRate(state, destinationCurrencyKey);

    if (baseRate === 0n) {
      baseRate =
        this._getExchangeFeeRate(state, sourceCurrencyKey) +
        this._getExchangeFeeRate(state, destinationCurrencyKey);
    }
    return baseRate;
  }

  private _deductFeesFromAmount(
    destinationAmount: bigint,
    exchangeFeeRate: bigint,
  ): bigint {
    return SafeDecimalMath.multiplyDecimal(
      destinationAmount,
      SafeDecimalMath.unit - exchangeFeeRate,
    );
  }

  private _getAtomicExchangeFeeRate(
    state: PoolState,
    currencyKey: string,
  ): bigint {
    // Onchain call adapted into state retrieval
    return state.atomicExchangeFeeRate[currencyKey];
  }

  private _getExchangeFeeRate(state: PoolState, currencyKey: string): bigint {
    // Onchain call adapted into state retrieval
    return state.exchangeFeeRate[currencyKey];
  }
}

export const synthetixMath = new SynthetixMath();
