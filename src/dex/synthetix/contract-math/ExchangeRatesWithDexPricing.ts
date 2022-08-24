import { NULL_ADDRESS } from '../../../constants';
import { Token, Address } from '../../../types';
import { getBigIntPow, _require } from '../../../utils';
import { PoolState } from '../types';
import { dexPriceAggregatorUniswapV3 } from './DexPriceAggregatorUniswapV3';
import { SafeDecimalMath } from './SafeDecimalMath';

class ExchangeRatesWithDexPricing {
  effectiveAtomicValueAndRates(
    state: PoolState,
    sourceCurrencyKey: string,
    sourceAmount: bigint,
    destinationCurrencyKey: string,
  ): [bigint, bigint, bigint, bigint] {
    const [systemValue, systemSourceRate, systemDestinationRate] =
      this._effectiveValueAndRates(
        state,
        sourceCurrencyKey,
        sourceAmount,
        destinationCurrencyKey,
      );

    const usePureChainlinkPriceForSource =
      this._getPureChainlinkPriceForAtomicSwapsEnabled(
        state,
        sourceCurrencyKey,
      );
    const usePureChainlinkPriceForDest =
      this._getPureChainlinkPriceForAtomicSwapsEnabled(
        state,
        destinationCurrencyKey,
      );
    let sourceRate = 0n;
    let destRate = 0n;

    if (usePureChainlinkPriceForSource) {
      sourceRate = systemSourceRate;
    } else {
      sourceRate = this._getMinValue(
        systemSourceRate,
        this._getPriceFromDexAggregator(
          state,
          sourceCurrencyKey,
          state.sUSDCurrencyKey,
          sourceAmount,
        ),
      );
    }

    if (usePureChainlinkPriceForDest) {
      destRate = systemDestinationRate;
    } else {
      destRate = this._getMaxValue(
        systemDestinationRate,
        this._getPriceFromDexAggregator(
          state,
          state.sUSDCurrencyKey,
          destinationCurrencyKey,
          sourceAmount,
        ),
      );
    }

    const value = (sourceAmount * sourceRate) / destRate;

    return [value, systemValue, systemSourceRate, systemDestinationRate];
  }

  private _effectiveValueAndRates(
    state: PoolState,
    sourceCurrencyKey: string,
    sourceAmount: bigint,
    destinationCurrencyKey: string,
  ): [bigint, bigint, bigint] {
    const sourceRate = this._getRate(state, sourceCurrencyKey);
    let value = 0n;
    let destinationRate = 0n;
    if (sourceCurrencyKey === destinationCurrencyKey) {
      destinationRate = sourceRate;
      value = sourceAmount;
    } else {
      destinationRate = this._getRate(state, destinationCurrencyKey);
      if (destinationRate > 0n) {
        value = SafeDecimalMath.divideDecimalRound(
          SafeDecimalMath.multiplyDecimalRound(sourceAmount, sourceRate),
          destinationRate,
        );
      }
    }
    return [value, sourceRate, destinationRate];
  }

  private _getRate(state: PoolState, currencyKey: string): bigint {
    return this._getRateAndUpdatedTime(state, currencyKey).rate;
  }

  private _getRateAndUpdatedTime(
    state: PoolState,
    currencyKey: string,
  ): { rate: bigint; time: bigint } {
    if (currencyKey === state.sUSDCurrencyKey) {
      return { rate: SafeDecimalMath.unit, time: 0n };
    } else {
      const aggregator = state.aggregators[currencyKey];
      return aggregator !== undefined
        ? {
            rate: BigInt.asUintN(
              216,
              this._formatAggregatorAnswer(
                state,
                currencyKey,
                aggregator.answer,
              ),
            ),
            time: BigInt.asUintN(40, aggregator.updatedAt),
          }
        : { rate: 0n, time: 0n };
    }
  }

  private _formatAggregatorAnswer(
    state: PoolState,
    currencyKey: string,
    rate: bigint,
  ): bigint {
    _require(
      rate >= 0,
      'Negative rate not supported',
      { rate, currencyKey },
      'rate >= 0',
    );
    const decimals = state.aggregatorDecimals[currencyKey];
    let result = BigInt.asUintN(256, rate);
    if (decimals === 0 || decimals === 18) {
      // do not convert for 0 (part of implicit interface), and not needed for 18
    } else if (decimals < 18) {
      // increase precision to 18
      const multiplier = getBigIntPow(18 - decimals); // SafeMath not needed since decimals is small
      result = result * multiplier;
    } else if (decimals > 18) {
      // decrease precision to 18
      const divisor = getBigIntPow(decimals - 18); // SafeMath not needed since decimals is small
      result = result / divisor;
    }
    return result;
  }

  private _getPureChainlinkPriceForAtomicSwapsEnabled(
    state: PoolState,
    currencyKey: string,
  ): boolean {
    return state.pureChainlinkPriceForAtomicSwapsEnabled[currencyKey];
  }

  private _getMinValue(x: bigint, y: bigint): bigint {
    return x < y ? x : y;
  }

  private _getMaxValue(x: bigint, y: bigint): bigint {
    return x > y ? x : y;
  }

  private _getPriceFromDexAggregator(
    state: PoolState,
    sourceCurrencyKey: string,
    destCurrencyKey: string,
    amount: bigint,
  ) {
    _require(
      amount !== 0n,
      'Amount must be greater than 0',
      { amount },
      'amount !== 0n',
    );
    _require(
      sourceCurrencyKey === state.sUSDCurrencyKey ||
        destCurrencyKey === state.sUSDCurrencyKey,
      'Atomic swaps must go through sUSD',
      { sourceCurrencyKey, destCurrencyKey },
      `sourceCurrencyKey === sUSD || destCurrencyKey === sUSD`,
    );

    const sourceEquivalent = this._getAtomicEquivalentForDexPricing(
      state,
      sourceCurrencyKey,
    );

    _require(
      sourceEquivalent.address !== NULL_ADDRESS,
      'No atomic equivalent for source',
      { sourceEquivalent },
      'sourceEquivalent !== NULL_ADDRESS',
    );

    const destEquivalent = this._getAtomicEquivalentForDexPricing(
      state,
      destCurrencyKey,
    );
    _require(
      destEquivalent.address !== NULL_ADDRESS,
      'No atomic equivalent for dest',
      { destEquivalent },
      'destEquivalent !== NULL_ADDRESS',
    );

    const result =
      (this._dexPriceDestinationValue(
        state,
        sourceEquivalent,
        destEquivalent,
        amount,
      ) *
        SafeDecimalMath.unit) /
      amount;
    _require(
      result !== 0n,
      'Result must be greater than 0',
      { result },
      'result !== 0n',
    );

    return destCurrencyKey === state.sUSDCurrencyKey
      ? result
      : SafeDecimalMath.divideDecimalRound(SafeDecimalMath.unit, result);
  }

  private _getAtomicEquivalentForDexPricing(
    state: PoolState,
    currencyKey: string,
  ): Token {
    return state.atomicEquivalentForDexPricing[currencyKey];
  }

  private _dexPriceDestinationValue(
    state: PoolState,
    sourceEquivalent: Token,
    destEquivalent: Token,
    sourceAmount: bigint,
  ): bigint {
    const sourceAmountInEquivalent =
      (sourceAmount * getBigIntPow(sourceEquivalent.decimals)) /
      SafeDecimalMath.unit;

    const twapWindow = this._getAtomicTwapWindow(state);
    _require(
      twapWindow !== 0n,
      'Uninitialized atomic twap window',
      { twapWindow },
      'twapWindow !== 0n',
    );

    const twapValueInEquivalent = dexPriceAggregatorUniswapV3.assetToAsset(
      state,
      sourceEquivalent.address,
      sourceAmountInEquivalent,
      destEquivalent.address,
      twapWindow,
    );
    _require(
      twapValueInEquivalent > 0n,
      'dex price returned 0',
      { twapValueInEquivalent },
      'twapValueInEquivalent > 0n',
    );

    // Similar to source amount, normalize decimals back to internal unit for output amount
    return (
      (twapValueInEquivalent * SafeDecimalMath.unit) /
      getBigIntPow(destEquivalent.decimals)
    );
  }

  private _getAtomicTwapWindow(state: PoolState): bigint {
    return state.atomicTwapWindow;
  }
}

export const exchangeRatesWithDexPricing = new ExchangeRatesWithDexPricing();
