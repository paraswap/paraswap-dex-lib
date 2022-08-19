import { PoolState } from '../types';
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
