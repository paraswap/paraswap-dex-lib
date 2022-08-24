import { _require } from '../../../utils';
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

  // TODO: Implement pricing for Optimism
  // getAmountsForExchange(
  //   state: PoolState,
  //   sourceAmount: bigint,
  //   sourceCurrencyKey: string,
  //   destinationCurrencyKey: string,
  // ) {
  //   const [exchangeFeeRate, tooVolatile] = this._feeRateForExchange(
  //     sourceCurrencyKey,
  //     destinationCurrencyKey,
  //   );

  //   // check rates volatility result
  //   _require(
  //     !tooVolatile,
  //     'exchange rates too volatile',
  //     { sourceAmount, sourceCurrencyKey, destinationCurrencyKey, tooVolatile },
  //     '!tooVolatile',
  //   );

  //   const destinationAmount = _effectiveValueAndRates(
  //     sourceCurrencyKey,
  //     sourceAmount,
  //     destinationCurrencyKey,
  //   );

  //   return this._deductFeesFromAmount(destinationAmount, exchangeFeeRate);
  // }

  // private _feeRateForExchange(
  //   state: PoolState,
  //   sourceCurrencyKey: string,
  //   destinationCurrencyKey: string,
  // ): [bigint, boolean] {
  //   // Get the exchange fee rate as per the source currencyKey and destination currencyKey
  //   const baseRate =
  //     this._getExchangeFeeRate(state, sourceCurrencyKey) +
  //     this._getExchangeFeeRate(state, destinationCurrencyKey);

  //   const [dynamicFee, tooVolatile] = this._dynamicFeeRateForExchange(
  //     state,
  //     sourceCurrencyKey,
  //     destinationCurrencyKey,
  //   );
  //   return [baseRate + dynamicFee, tooVolatile];
  // }

  // private _dynamicFeeRateForExchange(
  //   state: PoolState,
  //   sourceCurrencyKey: string,
  //   destinationCurrencyKey: string,
  // ): [bigint, boolean] {
  //   const config = getExchangeDynamicFeeConfig();
  //   const [dynamicFeeDst, dstVolatile] = this._dynamicFeeRateForCurrency(
  //     state,
  //     destinationCurrencyKey,
  //     config,
  //   );
  //   const [dynamicFeeSrc, srcVolatile] = this._dynamicFeeRateForCurrency(
  //     state,
  //     sourceCurrencyKey,
  //     config,
  //   );
  //   let dynamicFee = dynamicFeeDst + dynamicFeeSrc;
  //   // cap to maxFee
  //   const overMax = dynamicFee > config.maxFee;
  //   dynamicFee = overMax ? config.maxFee : dynamicFee;
  //   return [dynamicFee, overMax || dstVolatile || srcVolatile];
  // }

  // private _dynamicFeeRateForCurrency(
  //   state: PoolState,
  //   currencyKey: string,
  // ): [bigint, boolean] {
  //   // no dynamic dynamicFee for sUSD or too few rounds
  //   if (currencyKey === state.sUSDCurrencyKey || config.rounds <= 1) {
  //     return [0n, false];
  //   }
  //   const roundId = exchangeRates().getCurrentRoundId(currencyKey);
  //   return _dynamicFeeRateForCurrencyRound(currencyKey, roundId, config);
  // }

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
