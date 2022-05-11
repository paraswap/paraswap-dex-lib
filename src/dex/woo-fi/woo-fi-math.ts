import { PoolState, TokenInfo } from './types';
import { wooFiDecimalMath } from './woo-fi-decimal-math';

class WooFiPoolMath {
  // dMath = decimalMath
  readonly dMath: typeof wooFiDecimalMath = wooFiDecimalMath;

  querySellBase(
    state: PoolState,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    baseAmount: bigint,
  ): bigint {
    const quoteAmount = this._getQuoteAmountSellBase(
      state,
      quoteTokenAddress,
      baseTokenAddress,
      baseAmount,
    );
    const lpFee = this.dMath.mulCeil(
      quoteAmount,
      state.feeRates[baseTokenAddress],
    );
    return quoteAmount - lpFee;
  }

  querySellQuote(
    state: PoolState,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    quoteAmount: bigint,
  ): bigint {
    const lpFee = this.dMath.mulCeil(
      quoteAmount,
      state.feeRates[baseTokenAddress],
    );
    quoteAmount -= lpFee;
    return this._getBaseAmountSellQuote(
      state,
      quoteTokenAddress,
      baseTokenAddress,
      quoteAmount,
    );
  }

  protected _getQuoteAmountSellBase(
    state: PoolState,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    baseAmount: bigint,
  ): bigint {
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
  }

  protected _getBaseAmountSellQuote(
    state: PoolState,
    quoteTokenAddress: string,
    baseTokenAddress: string,
    quoteAmount: bigint,
  ): bigint {
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
    const baseTarget =
      baseInfo.reserve > baseInfo.threshold
        ? baseInfo.reserve
        : baseInfo.threshold;
    if (baseInfo.reserve < baseTarget) {
      baseBought = baseTarget - baseInfo.reserve;
    } else {
      baseSold = baseInfo.reserve - baseTarget;
    }

    let quoteSold = 0n;
    const quoteTarget =
      quoteInfo.reserve > baseInfo.threshold
        ? quoteInfo.reserve
        : baseInfo.threshold;
    if (quoteInfo.reserve < quoteTarget) {
      quoteBought = quoteTarget - quoteInfo.reserve;
    } else {
      quoteSold = quoteInfo.reserve - quoteTarget;
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
}

export const wooFiMath = new WooFiPoolMath();
