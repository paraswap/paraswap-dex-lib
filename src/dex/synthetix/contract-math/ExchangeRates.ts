import { _require } from '../../../utils';
import { PoolState } from '../types';
import { exchangeRatesWithDexPricing } from './ExchangeRatesWithDexPricing';
import { SafeDecimalMath } from './SafeDecimalMath';

export class ExchangeRates {
  effectiveValueAndRates(
    state: PoolState,
    sourceCurrencyKey: string,
    sourceAmount: bigint,
    destinationCurrencyKey: string,
  ): bigint {
    return 0n;
  }

  getCurrentRoundId(state: PoolState, currencyKey: string): bigint {
    if (currencyKey == state.sUSDCurrencyKey) {
      return 0n;
    }
    const aggregator = state.aggregators[currencyKey];
    if (aggregator !== undefined) {
      return aggregator.latestRoundData.roundId;
    } // else return defaults, to avoid reverting in views
    return 0n;
  }

  ratesAndUpdatedTimeForCurrencyLastNRounds(
    state: PoolState,
    currencyKey: string,
    numRounds: bigint,
    roundId: bigint,
  ): [bigint[], bigint[]] {
    const rates: bigint[] = new Array(numRounds).fill(0n);
    const times: bigint[] = new Array(numRounds).fill(0n);

    roundId =
      roundId > 0n ? roundId : this.getCurrentRoundId(state, currencyKey);

    for (let i = 0; i < numRounds; i++) {
      // fetch the rate and treat is as current, so inverse limits if frozen will always be applied
      // regardless of current rate
      [rates[i], times[i]] = this._getRateAndTimestampAtRound(
        state,
        currencyKey,
        roundId,
      );

      if (roundId === 0n) {
        // if we hit the last round, then return what we have
        return [rates, times];
      } else {
        roundId--;
      }
    }
    return [rates, times];
  }

  private _getRateAndTimestampAtRound(
    state: PoolState,
    currencyKey: string,
    roundId: bigint,
  ): [bigint, bigint] {
    // short circuit sUSD
    if (currencyKey == state.sUSDCurrencyKey) {
      // sUSD has no rounds, and 0 time is preferable for "volatility" heuristics
      // which are used in atomic swaps and fee reclamation
      return [SafeDecimalMath.unit, 0n];
    } else {
      const aggregator = state.aggregators[currencyKey];
      // else return defaults, to avoid reverting in views
      if (aggregator === undefined) {
        return [0n, 0n];
      }

      const roundData = aggregator.getRoundData[roundId.toString()];

      _require(
        roundData !== undefined,
        'Requested roundData is not fetched',
        { roundId, currencyKey, aggregator },
        'roundData !== undefined',
      );

      return [
        exchangeRatesWithDexPricing.formatAggregatorAnswer(
          state,
          currencyKey,
          aggregator.getRoundData[roundId.toString()].answer,
        ),
        aggregator.getRoundData[roundId.toString()].updatedAt,
      ];
    }
  }
}

export const exchangeRates = new ExchangeRates();
