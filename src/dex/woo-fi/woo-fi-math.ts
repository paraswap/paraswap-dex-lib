import { PoolState, TokenInfo } from './types';
import { wooFiDecimalMath } from './woo-fi-decimal-math';
import { Address, Logger } from '../../types';
import { BI_MAX_UINT96, BI_POWS } from '../../bigint-constants';
import { _require } from '../../utils';
import { NULL_STATE } from './constants';
import { NULL_ADDRESS } from '../../constants';

export class WooFiMath {
  // dMath = decimalMath
  readonly dMath: typeof wooFiDecimalMath = wooFiDecimalMath;

  private readonly _MIN_INPUT_DEFAULT = BI_POWS[16]; // 0.01 xToken

  private readonly _MAX_INPUT_DEFAULT = BI_POWS[20]; //  100 xToken

  state: PoolState = NULL_STATE;

  quoteToken = NULL_ADDRESS

  constructor(private readonly logger: Logger) {}

  querySellBase(
    baseToken: Address,
    baseAmounts: bigint[],
  ): bigint[] | null {
    try {
      baseAmounts.map(baseAmount => {
        this._checkInputAmount(baseTokenAddress, baseAmount);
      });
    } catch (e) {
      this.logger.warn('WooFi Guardian check _checkInputAmount Error:', e);
      return null;
    }

    this._autoUpdate(quoteTokenAddress, baseTokenAddress);

    const quoteAmounts = this._getQuoteAmountSellBase(
      baseToken,
      baseAmounts,
    );
    const feeRate = this.state.feeRates[baseToken];
    return this._takeFee(quoteAmounts, feeRate);
  }

  querySellQuote(
    baseToken: Address,
    quoteAmounts: bigint[],
  ): bigint[] | null {
    this._autoUpdate(quoteTokenAddress, baseToken);

    const feeRate = this.state.feeRates[baseToken];
    quoteAmounts = this._takeFee(quoteAmounts, feeRate);

    return this._getBaseAmountSellQuote(
      baseToken,
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
    baseToken: Address,
    baseAmounts: bigint[],
  ): bigint[] {
    const quoteInfo = this.state.tokenInfos[this.quoteToken];
    const baseInfo = this.state.tokenInfos[baseToken];

    let {
      priceNow: p,
      spreadNow: s,
      coeffNow: k,
    } = this.state.tokenStates[baseToken];

    this._checkSwapPrice(p, baseToken, this.quoteToken)

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
    quoteTokenAddress: string,
    baseTokenAddress: string,
    quoteAmounts: bigint[],
  ): bigint[] {
    const quoteInfo = this.state.tokenInfos[quoteTokenAddress];
    const baseInfo = this.state.tokenInfos[baseTokenAddress];

    let {
      priceNow: p,
      spreadNow: s,
      coeffNow: k,
    } = this.state.tokenStates[baseTokenAddress];

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

  protected _autoUpdate(quoteTokenAddress: string, baseTokenAddress: string) {
    const quoteInfo = this.state.tokenInfos[quoteTokenAddress];
    const baseInfo = this.state.tokenInfos[baseTokenAddress];

    if (this.state.oracleTimestamp !== baseInfo.lastResetTimestamp) {
      baseInfo.target =
        baseInfo.threshold > baseInfo.reserve
          ? baseInfo.threshold
          : baseInfo.reserve;
      baseInfo.lastResetTimestamp = this.state.oracleTimestamp;
    }
    if (this.state.oracleTimestamp !== quoteInfo.lastResetTimestamp) {
      quoteInfo.target =
        quoteInfo.threshold > quoteInfo.reserve
          ? quoteInfo.threshold
          : quoteInfo.reserve;
      quoteInfo.lastResetTimestamp = this.state.oracleTimestamp;
    }
  }

  private _checkInputAmount(token: Address, inputAmount: bigint) {
    _require(
      inputAmount < BI_MAX_UINT96,
      `WooGuardian: inputAmount_uint96_OVERFLOW in _checkInputAmount for ${token}`,
    );

    const info = this.state.guardian.refInfos[token];
    const minInputAmount =
      info.minInputAmount != 0n ? info.minInputAmount : this._MIN_INPUT_DEFAULT;
    const maxInputAmount =
      info.maxInputAmount != 0n ? info.maxInputAmount : this._MAX_INPUT_DEFAULT;

    _require(
      inputAmount >= minInputAmount,
      `WooGuardian: inputAmount_LTM in _checkInputAmount for ${token}`,
    );
    _require(
      inputAmount <= maxInputAmount,
      `WooGuardian: inputAmount_GTM in _checkInputAmount for ${token}`,
    );
  }

  private _checkSwapAmount(
    fromToken: Address,
    toToken: Address,
    fromAmount: bigint,
    toAmount: bigint,
  ) {
    const refPrice = this._refPrice(fromToken, toToken);
    const refToAmount = this.dMath.mulFloor(fromAmount, refPrice);

    const bound = this._boundForTokens(fromToken, toToken);

    _require(
      this.dMath.mulFloor(refToAmount, BI_POWS[18] - bound) <= toAmount &&
        toAmount <= this.dMath.mulCeil(refToAmount, BI_POWS[18] + bound),
      `WooGuardian: TO_AMOUNT_UNRELIABLE in _checkSwapAmount for ${toToken}`,
    );
  }

  private _checkSwapPrice(price: bigint, fromToken: Address, toToken: Address) {
    const refPrice = this._refPrice(fromToken, toToken);
    const bound = this._boundForTokens(fromToken, toToken);
    _require(
      this.dMath.mulFloor(refPrice, BI_POWS[18] - bound) <= price &&
        price <= this.dMath.mulCeil(refPrice, BI_POWS[18] + bound),
      `WooGuardian: PRICE_UNRELIABLE in _checkSwapPrice fromToken=${fromToken} and toToken=${toToken}`,
    );
  }

  private _refPrice(fromToken: Address, toToken: Address) {
    const baseInfo = this.state.guardian.refInfos[fromToken];
    const quoteInfo = this.state.guardian.refInfos[toToken];

    const { answer: rawBaseRefPrice } =
      this.state.chainlink.latestRoundData[baseInfo.chainlinkRefOracle];

    _require(
      rawBaseRefPrice >= 0,
      `WooGuardian: INVALID_CHAINLINK_PRICE in _refPrice for ${fromToken}`,
    );

    const { answer: rawQuoteRefPrice } =
      this.state.chainlink.latestRoundData[quoteInfo.chainlinkRefOracle];

    _require(
      rawQuoteRefPrice >= 0,
      `WooGuardian: INVALID_CHAINLINK_QUOTE_PRICE in _refPrice for ${toToken}`,
    );

    const baseRefPrice = rawBaseRefPrice * baseInfo.refPriceFixCoeff;
    const quoteRefPrice = rawQuoteRefPrice * quoteInfo.refPriceFixCoeff;

    return this.dMath.divFloor(baseRefPrice, quoteRefPrice);
  }

  private _boundForTokens(token1: Address, token2: Address) {
    const info1 = this.state.guardian.refInfos[token1];
    const bound1 =
      info1.bound !== 0n ? info1.bound : this.state.guardian.globalBound;

    const info2 = this.state.guardian.refInfos[token2];
    const bound2 =
      info2.bound != 0n ? info2.bound : this.state.guardian.globalBound;

    return bound1 > bound2 ? bound1 : bound2;
  }
}
