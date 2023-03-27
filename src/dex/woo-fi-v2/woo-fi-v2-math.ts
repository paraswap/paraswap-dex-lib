import { PoolState, TokenState } from './types';
import { Address, Logger } from '../../types';
import { BI_POWS } from '../../bigint-constants';
import { _require } from '../../utils';
import { NULL_STATE } from './constants';

function handleMathError(e: unknown, logger: Logger) {
  if (e instanceof Error && e.message.startsWith('WooGuardian:')) {
    logger.warn('WooFi Guardian check Error:', e);
    return;
  }
  logger.error('Unexpected error in WooFi math:', e);
}

function max(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export class WooFiV2Math {
  state: PoolState = NULL_STATE;

  constructor(
    private readonly logger: Logger,
    private readonly _quoteToken: Address,
  ) {}

  query(
    fromToken: Address,
    toToken: Address,
    fromAmounts: bigint[],
  ): bigint[] | null {
    try {
      if (fromToken === this._quoteToken) {
        return this._querySellQuote(toToken, fromAmounts);
      } else if (toToken === this._quoteToken) {
        return this._querySellBase(fromToken, fromAmounts);
      } else {
        return this._queryBaseToBase(fromToken, toToken, fromAmounts);
      }
    } catch (e) {
      handleMathError(e, this.logger);
      return null;
    }
  }

  _querySellBase(baseToken: Address, baseAmounts: bigint[]): bigint[] | null {
    try {
      const _state = this.state.tokenStates[baseToken];
      let quoteAmounts = this._calcQuoteAmountSellBase(
        baseToken,
        baseAmounts,
        _state,
      );

      quoteAmounts = quoteAmounts.map(amount => {
        return amount <= this.state.tokenInfos[this._quoteToken].reserve
          ? amount
          : 0n;
      });

      const feeRate = this.state.tokenInfos[baseToken].feeRate;
      return this._takeFee(quoteAmounts, feeRate);
    } catch (e) {
      handleMathError(e, this.logger);
      return null;
    }
  }

  _querySellQuote(baseToken: Address, quoteAmounts: bigint[]): bigint[] | null {
    try {
      const feeRate = this.state.tokenInfos[baseToken].feeRate;
      quoteAmounts = this._takeFee(quoteAmounts, feeRate);

      const _state = this.state.tokenStates[baseToken];
      let toAmounts = this._calcBaseAmountSellQuote(
        baseToken,
        quoteAmounts,
        _state,
      );

      const baseReserve = this.state.tokenInfos[baseToken].reserve;
      return toAmounts.map(amount => {
        return amount <= baseReserve ? amount : 0n;
      });
    } catch (e) {
      handleMathError(e, this.logger);
      return null;
    }
  }

  _queryBaseToBase(
    baseToken1: Address,
    baseToken2: Address,
    base1Amounts: bigint[],
  ): bigint[] | null {
    try {
      let state1: TokenState = this.state.tokenStates[baseToken1];
      let state2: TokenState = this.state.tokenStates[baseToken2];

      const feeRate1 = this.state.tokenInfos[baseToken1].feeRate;
      const feeRate2 = this.state.tokenInfos[baseToken2].feeRate;

      const spread = max(state1.spread, state2.spread) / 2n;
      const feeRate = max(feeRate1, feeRate2);

      state1.spread = spread;
      state2.spread = spread;

      let quoteAmounts = this._calcQuoteAmountSellBase(
        baseToken1,
        base1Amounts,
        state1,
      );
      quoteAmounts = this._takeFeeAndCheckReserve(quoteAmounts, feeRate);

      let toAmounts = this._calcBaseAmountSellQuote(
        baseToken2,
        quoteAmounts,
        state2,
      );

      return toAmounts.map(toAmount => {
        return toAmount <= this.state.tokenInfos[baseToken2].reserve
          ? toAmount
          : 0n;
      });
    } catch (e) {
      handleMathError(e, this.logger);
      return null;
    }
  }

  protected _takeFeeAndCheckReserve(
    amounts: bigint[],
    feeRate: bigint,
  ): bigint[] {
    return amounts.map(amount => {
      if (amount === 0n) return 0n;
      const lpFee = (amount * feeRate) / BI_POWS[5];
      const reserve = this.state.tokenInfos[this._quoteToken].reserve;
      return lpFee > reserve ? 0n : amount - lpFee;
    });
  }

  protected _takeFee(amounts: bigint[], feeRate: bigint): bigint[] {
    return amounts.map(amount => {
      const lpFee = (amount * feeRate) / BI_POWS[5];
      return amount === 0n ? 0n : amount - lpFee;
    });
  }

  protected _calcQuoteAmountSellBase(
    baseToken: Address,
    baseAmounts: bigint[],
    state: TokenState,
  ): bigint[] {
    let { priceDec, quoteDec, baseDec } = this.state.decimals[baseToken];

    return baseAmounts.map(baseAmount => {
      if (baseAmount === 0n) return 0n;

      const coef: bigint =
        BI_POWS[18] -
        (state.coeff * baseAmount * state.price) / baseDec / priceDec -
        state.spread;

      return (
        (((baseAmount * quoteDec * state.price) / priceDec) * coef) /
        BI_POWS[18] /
        baseDec
      );
    });
  }

  protected _calcBaseAmountSellQuote(
    baseToken: string,
    quoteAmounts: bigint[],
    state: TokenState,
  ): bigint[] {
    let { priceDec, quoteDec, baseDec } = this.state.decimals[baseToken];

    return quoteAmounts.map(quoteAmount => {
      if (quoteAmount === 0n) return 0n;

      const coef: bigint =
        BI_POWS[18] - (quoteAmount * state.coeff) / quoteDec - state.spread;

      return (
        (((quoteAmount * baseDec * priceDec) / state.price) * coef) /
        BI_POWS[18] /
        quoteDec
      );
    });
  }
}
