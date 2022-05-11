import { PoolState, TokenInfo } from './types';
import { wooFiDecimalMath } from './woo-fi-decimal-math';

class WooFiPoolMath {
  // dMath = decimalMath
  readonly dMath: typeof wooFiDecimalMath = wooFiDecimalMath;

  querySellBase(
    state: PoolState,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    baseAmounts: bigint[],
  ): bigint[] {
    this._autoUpdate(state, quoteTokenAddress, baseTokenAddress);

    const quoteAmounts = this._getQuoteAmountSellBase(
      state,
      quoteTokenAddress,
      baseTokenAddress,
      baseAmounts,
    );
    const feeRate = state.feeRates[baseTokenAddress];
    return this._takeFee(quoteAmounts, feeRate);
  }

  querySellQuote(
    state: PoolState,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    quoteAmounts: bigint[],
  ): bigint[] {
    this._autoUpdate(state, quoteTokenAddress, baseTokenAddress);

    const feeRate = state.feeRates[baseTokenAddress];
    quoteAmounts = this._takeFee(quoteAmounts, feeRate);

    return this._getBaseAmountSellQuote(
      state,
      quoteTokenAddress,
      baseTokenAddress,
      quoteAmounts,
    );
  }

  protected _takeFee(amounts: bigint[], feeRate: bigint): bigint[] {
    return amounts.map(amount => {
      const lpFee = this.dMath.mulCeil(amount, feeRate);
      return amount === 0n ? 0n : amount - lpFee;
    });
  }

  protected _getQuoteAmountSellBase(
    state: PoolState,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    baseAmounts: bigint[],
  ): bigint[] {
    const quoteInfo = state.tokenInfos[quoteTokenAddress];
    const baseInfo = state.tokenInfos[baseTokenAddress];

    let {
      priceNow: p,
      spreadNow: s,
      coeffNow: k,
    } = state.tokenStates[baseTokenAddress];

    // price: p * (1 - s / 2)
    p = this.dMath.mulFloor(
      p,
      this.dMath.ONE - this.dMath.divCeil(s, this.dMath.TWO),
    );
    const { baseBought, quoteBought } = this._getBoughtAmount(
      baseInfo,
      quoteInfo,
      p,
      k,
      true,
    );

    return baseAmounts.map(baseAmount => {
      if (baseAmount === 0n) return 0n;

      if (baseBought > 0n) {
        const quoteSold = this._getQuoteAmountLowBaseSide(
          p,
          k,
          baseInfo.R,
          baseBought,
        );
        if (baseAmount > baseBought) {
          const newBaseSold = baseAmount - baseBought;
          return (
            quoteSold +
            this._getQuoteAmountLowQuoteSide(p, k, this.dMath.ONE, newBaseSold)
          );
        } else {
          const newBaseBought = baseBought - baseAmount;
          return (
            quoteSold -
            this._getQuoteAmountLowBaseSide(p, k, baseInfo.R, newBaseBought)
          );
        }
      } else {
        const baseSold = this._getBaseAmountLowQuoteSide(
          p,
          k,
          this.dMath.ONE,
          quoteBought,
        );
        const newBaseSold = baseAmount + baseSold;
        const newQuoteBought = this._getQuoteAmountLowQuoteSide(
          p,
          k,
          this.dMath.ONE,
          newBaseSold,
        );
        return newQuoteBought > quoteBought ? newQuoteBought - quoteBought : 0n;
      }
    });
  }

  protected _getBaseAmountSellQuote(
    state: PoolState,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    quoteAmounts: bigint[],
  ): bigint[] {
    const quoteInfo = state.tokenInfos[quoteTokenAddress];
    const baseInfo = state.tokenInfos[baseTokenAddress];

    let {
      priceNow: p,
      spreadNow: s,
      coeffNow: k,
    } = state.tokenStates[baseTokenAddress];

    // price: p * (1 + s / 2)
    p = this.dMath.mulCeil(
      p,
      this.dMath.ONE + this.dMath.divCeil(s, this.dMath.TWO),
    );

    const { baseBought, quoteBought } = this._getBoughtAmount(
      baseInfo,
      quoteInfo,
      p,
      k,
      false,
    );

    return quoteAmounts.map(quoteAmount => {
      if (quoteAmount === 0n) return 0n;

      if (quoteBought > 0) {
        const baseSold = this._getBaseAmountLowQuoteSide(
          p,
          k,
          baseInfo.R,
          quoteBought,
        );
        if (quoteAmount > quoteBought) {
          const newQuoteSold = quoteAmount - quoteBought;
          return (
            baseSold +
            this._getBaseAmountLowBaseSide(p, k, this.dMath.ONE, newQuoteSold)
          );
        } else {
          const newQuoteBought = quoteBought - quoteAmount;
          return (
            baseSold -
            this._getBaseAmountLowQuoteSide(p, k, baseInfo.R, newQuoteBought)
          );
        }
      } else {
        const quoteSold = this._getQuoteAmountLowBaseSide(
          p,
          k,
          this.dMath.ONE,
          baseBought,
        );
        const newQuoteSold = quoteAmount + quoteSold;
        const newBaseBought = this._getBaseAmountLowBaseSide(
          p,
          k,
          this.dMath.ONE,
          newQuoteSold,
        );
        return newBaseBought > baseBought ? newBaseBought - baseBought : 0n;
      }
    });
  }

  protected _getBoughtAmount(
    baseInfo: TokenInfo,
    quoteInfo: TokenInfo,
    p: bigint,
    k: bigint,
    isSellBase: boolean,
  ) {
    let baseBought = 0n;
    let quoteBought = 0n;

    let baseSold = 0n;
    if (baseInfo.reserve < baseInfo.target) {
      baseBought = baseInfo.target - baseInfo.reserve;
    } else {
      baseSold = baseInfo.reserve - baseInfo.target;
    }

    let quoteSold = 0n;
    if (quoteInfo.reserve < quoteInfo.target) {
      quoteBought = quoteInfo.target - quoteInfo.reserve;
    } else {
      quoteSold = quoteInfo.reserve - quoteInfo.target;
    }

    if (this.dMath.mulCeil(baseSold, p) > quoteSold) {
      baseSold = baseSold - this.dMath.divFloor(quoteSold, p);
      quoteSold = 0n;
    } else {
      quoteSold = quoteSold - this.dMath.mulCeil(baseSold, p);
      baseSold = 0n;
    }
    const virtualBaseBought = this._getBaseAmountLowBaseSide(
      p,
      k,
      this.dMath.ONE,
      quoteSold,
    );
    if (isSellBase === virtualBaseBought < baseBought) {
      baseBought = virtualBaseBought;
    }
    const virtualQuoteBought = this._getQuoteAmountLowQuoteSide(
      p,
      k,
      this.dMath.ONE,
      baseSold,
    );
    if (isSellBase === virtualQuoteBought > quoteBought) {
      quoteBought = virtualQuoteBought;
    }

    return { baseBought, quoteBought };
  }

  protected _getBaseAmountLowBaseSide(
    p: bigint,
    k: bigint,
    r: bigint,
    quoteAmount: bigint,
  ) {
    // priceFactor = 1 + k * quoteAmount * r;
    const priceFactor =
      this.dMath.ONE +
      this.dMath.mulCeil(this.dMath.mulCeil(k, quoteAmount), r);

    // quoteAmount / p / priceFactor;
    return this.dMath.divFloor(
      this.dMath.divFloor(quoteAmount, p),
      priceFactor,
    );
  }

  protected _getQuoteAmountLowQuoteSide(
    p: bigint,
    k: bigint,
    r: bigint,
    baseAmount: bigint,
  ) {
    // priceFactor = 1 + k * baseAmount * p * r;
    const priceFactor =
      this.dMath.ONE +
      this.dMath.mulCeil(
        this.dMath.mulCeil(this.dMath.mulCeil(k, baseAmount), p),
        r,
      );

    // baseAmount * p / priceFactor;
    return this.dMath.divFloor(this.dMath.mulFloor(baseAmount, p), priceFactor);
  }

  protected _getBaseAmountLowQuoteSide(
    p: bigint,
    k: bigint,
    r: bigint,
    quoteAmount: bigint,
  ) {
    // priceFactor = (1 - k * quoteAmount * r);
    const priceFactor =
      this.dMath.ONE -
      this.dMath.mulFloor(this.dMath.mulFloor(k, quoteAmount), r);

    // quoteAmount / p / priceFactor;
    return this.dMath.divFloor(
      this.dMath.divFloor(quoteAmount, p),
      priceFactor,
    );
  }

  protected _getQuoteAmountLowBaseSide(
    p: bigint,
    k: bigint,
    r: bigint,
    baseAmount: bigint,
  ) {
    // priceFactor = 1 - k * baseAmount * p * r;
    const priceFactor =
      this.dMath.ONE -
      this.dMath.mulFloor(
        this.dMath.mulFloor(this.dMath.mulFloor(k, baseAmount), p),
        r,
      );
    // baseAmount * p / priceFactor;
    return this.dMath.divFloor(this.dMath.mulFloor(baseAmount, p), priceFactor);
  }

  protected _autoUpdate(
    state: PoolState,
    quoteTokenAddress: string,
    baseTokenAddress: string,
  ) {
    const quoteInfo = state.tokenInfos[quoteTokenAddress];
    const baseInfo = state.tokenInfos[baseTokenAddress];

    if (state.oracleTimestamp !== baseInfo.lastResetTimestamp) {
      baseInfo.target =
        baseInfo.threshold > baseInfo.reserve
          ? baseInfo.threshold
          : baseInfo.reserve;
      baseInfo.lastResetTimestamp = state.oracleTimestamp;
    }
    if (state.oracleTimestamp !== quoteInfo.lastResetTimestamp) {
      quoteInfo.target =
        quoteInfo.threshold > quoteInfo.reserve
          ? quoteInfo.threshold
          : quoteInfo.reserve;
      quoteInfo.lastResetTimestamp = state.oracleTimestamp;
    }
  }
}

export const wooFiMath = new WooFiPoolMath();
