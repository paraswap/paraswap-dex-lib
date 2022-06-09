import { MaverickPoolState } from './types';
import { MMath } from './maverick-math';
import { BI_POWS } from '../../bigint-constants';
import { MathSol } from '../balancer-v2/balancer-v2-math';

type ActiveInfo = {
  c?: bigint;
  a0?: bigint;
  a1?: bigint;
  q0?: bigint;
  q1?: bigint;
  q2?: bigint;
  b0?: bigint;
  b1?: bigint;
  b2?: bigint;
  L?: bigint;
};

type ComputeInfo = {
  quoteDelta: bigint;
  baseDelta: bigint;
  excess: bigint;
  newPrice: bigint;
};

export class MaverickPool {
  maxSpreadFee: bigint;
  lamb_w: bigint;
  lamb2_w: bigint;
  lam2_kw: bigint;
  ind_0_a2: bigint;
  ind_1_a2: bigint;
  ind_2_a2: bigint;
  lambdas: bigint[];
  gammas: bigint[];
  binThreshold: bigint;
  lambda_bar: bigint;
  gamma_bar: bigint;
  sk: bigint;
  sw: bigint;
  gam2_k: bigint;
  gam_w: bigint;
  state: MaverickPoolState;

  constructor(
    private dexKey: string,
    private epsilon: bigint,
    private fee: bigint,
    private protocolFeeRatio: bigint,
    private spreadFeeMultiplier: bigint,
    private twauLookback: bigint,
    private uShiftMultiplier: bigint,
    public w: bigint,
    public k: bigint,
    public h: bigint,
  ) {
    this.maxSpreadFee = BigInt(0.99e18) - this.fee;
    this.sk = MMath.sqrt(k);
    this.sw = MMath.sqrt(w);

    this.gammas = [
      MMath.div(BI_POWS[18], MMath.mul(this.sk, this.sw) - this.sw),
      MMath.div(this.sw, this.w - BI_POWS[18]),
      MMath.div(MMath.mul(this.sw, this.sk), this.sk - BI_POWS[18]),
    ];
    this.state = {
      quoteBalance: 0n,
      baseBalance: 0n,
      u: 0n,
      twau: 0n,
      lastTimestamp: 0n,
    };
    this.lambdas = [this.gammas[2], this.gammas[1], this.gammas[0]];

    const gamma_h =
      BI_POWS[18] + MMath.div(MMath.mul(h, this.gammas[2]), this.gammas[1]);
    this.binThreshold = MMath.div(
      this.gammas[2],
      MMath.mul(this.lambdas[0], gamma_h),
    );
    this.lamb_w = MMath.div(MMath.mul(this.h, this.lambdas[0]), this.sw);

    this.lamb2_w = MMath.mul(
      MMath.mul(
        MMath.mul(this.lambdas[0], this.lambdas[0]),
        MMath.div(BI_POWS[18], this.w) - BI_POWS[18],
      ),
      MMath.mul(this.h, this.h),
    );

    this.ind_1_a2 = BI_POWS[18] - MathSol.mul(2n, this.lamb_w) + this.lamb2_w;
    this.gamma_bar = MMath.div(
      this.gammas[2],
      BI_POWS[18] +
        MMath.div(MMath.mul(this.h, this.gammas[2]), this.gammas[1]),
    );
    this.gam_w = MMath.div(MMath.div(this.gamma_bar, this.sw), this.sk);
    this.gam2_k = MMath.mul(
      MMath.mul(this.gamma_bar, this.gamma_bar),
      MMath.div(BI_POWS[18], this.sk) - BI_POWS[18],
    );

    this.ind_0_a2 = this.gam2_k - this.gam_w;
    this.lambda_bar = MMath.div(
      BI_POWS[18],
      MMath.div(BI_POWS[18], this.lambdas[0]) +
        MMath.div(this.h, this.lambdas[1]),
    );
    this.lam2_kw = MMath.mul(
      MMath.mul(this.lambda_bar, this.lambda_bar),
      MMath.mul(this.sw, BI_POWS[18] - this.sk),
    );
    this.ind_2_a2 = -this.lambda_bar + this.lam2_kw;
  }

  setState(state: MaverickPoolState) {
    this.state = state;
  }

  swap(state: MaverickPoolState, amount: bigint, swapForBase: boolean): bigint {
    if (state.quoteBalance == 0n || state.baseBalance == 0n) {
      return 0n;
    }
    this.state = state;
    if (swapForBase) {
      return this._swapQuoteForBase(amount, true);
    } else {
      return this._swapBaseForQuote(amount, true);
    }
  }

  _spreadFee() {
    const _twau = this._calculateTwau(this.state.u);
    if (this.state.u > _twau) {
      return MMath.min(
        this.maxSpreadFee,
        MMath.mul(
          BI_POWS[18] - MMath.div(_twau, this.state.u),
          this.spreadFeeMultiplier,
        ),
      );
    } else {
      return MMath.max(
        -this.maxSpreadFee,
        MMath.mul(
          MMath.div(this.state.u, _twau) - BI_POWS[18],
          this.spreadFeeMultiplier,
        ),
      );
    }
  }

  _getTimestamp() {
    return BigInt(parseInt((new Date().getTime() / 1000).toFixed(0)));
  }

  _calculateTwau(newU: bigint) {
    const timeDiff = this._getTimestamp() - this.state.lastTimestamp;

    if (
      (timeDiff == 0n && this.state.twau == 0n) ||
      timeDiff >= this.twauLookback
    ) {
      return newU;
    }
    const a = MMath.div(this.twauLookback - timeDiff, this.twauLookback);

    return MMath.mul(a, this.state.twau) + MMath.mul(BI_POWS[18] - a, newU);
  }

  _addFeeToEscrow(amount: bigint, isQuote: boolean) {
    const spreadFee = this._spreadFee();
    let txFee;
    let assetFee;

    if (isQuote) {
      if (spreadFee < 0) {
        txFee = this.fee - spreadFee;
      } else {
        txFee = this.fee;
      }
      txFee = MMath.min(BigInt(0.999e18), txFee);
      assetFee = MMath.mul(amount, txFee);
      const protocolFee = MMath.mul(assetFee, this.protocolFeeRatio);
      this.state.quoteBalance += assetFee - protocolFee;
    } else {
      if (spreadFee > 0) {
        txFee = this.fee + spreadFee;
      } else {
        txFee = this.fee;
      }
      txFee = MMath.min(BigInt(0.999e18), txFee);
      assetFee = MMath.mul(amount, txFee);
      const protocolFee = MMath.mul(assetFee, this.protocolFeeRatio);
      this.state.baseBalance += assetFee - protocolFee;
    }
    return amount - assetFee;
  }

  _quadraticRoots(a: bigint, b: bigint, c: bigint) {
    const d = MMath.div(
      MMath.sqrt(MMath.mul(b, b) - MathSol.mul(4n, MMath.mul(a, c))),
      MathSol.mul(2n, a),
    );
    return MMath.max(0n, MMath.div(-b, MathSol.mul(2n, a)) + d);
  }

  _getActiveInd() {
    if (
      this.state.quoteBalance <=
      MMath.mul(
        MMath.mul(this.state.baseBalance, this.state.u),
        this.binThreshold,
      )
    ) {
      return 0;
    }

    if (
      MMath.mul(this.state.baseBalance, this.state.u) <=
      MMath.mul(this.state.quoteBalance, this.binThreshold)
    ) {
      return 2;
    }

    return 1;
  }

  _getAssetsInActiveBin() {
    const activeInd = this._getActiveInd();
    const su = MMath.sqrt(this.state.u);
    let activeInfo: ActiveInfo = {};
    if (activeInd == 1) {
      const _lamb_w = this.lamb_w;
      const quotelamb = MMath.mul(this.state.quoteBalance, this.lamb2_w);
      activeInfo.c =
        MMath.mul(this.state.u, this.state.baseBalance) -
        this.state.quoteBalance;
      activeInfo.a0 = MMath.mul(
        this.state.quoteBalance,
        MMath.mul(_lamb_w, activeInfo.c) + quotelamb,
      );
      activeInfo.a1 =
        activeInfo.c +
        MMath.mul(
          _lamb_w,
          MathSol.mul(2n, this.state.quoteBalance) - activeInfo.c,
        ) -
        MathSol.mul(2n, quotelamb);

      activeInfo.q1 = this._quadraticRoots(
        this.ind_1_a2,
        activeInfo.a1,
        activeInfo.a0,
      );

      activeInfo.q0 = this.state.quoteBalance - activeInfo.q1;
      activeInfo.q2 = 0n;
      activeInfo.b2 = MMath.div(activeInfo.q0, this.state.u);
      activeInfo.b1 = this.state.baseBalance - activeInfo.b2;
      activeInfo.b0 = 0n;
      activeInfo.L = MMath.div(MMath.mul(activeInfo.q0, this.lambdas[0]), su);
    } else if (activeInd == 0) {
      activeInfo.a0 = MMath.mul(
        this.state.baseBalance,
        MMath.div(
          MMath.mul(
            MMath.mul(this.gamma_bar, this.state.quoteBalance),
            this.sw,
          ),
          this.state.u,
        ) + MMath.mul(this.state.baseBalance, this.gam2_k),
      );

      activeInfo.a1 =
        MMath.mul(
          MMath.div(this.state.quoteBalance, this.state.u),
          BI_POWS[18] - MMath.mul(this.sw, this.gamma_bar),
        ) +
        MMath.mul(
          this.state.baseBalance,
          this.gam_w - MathSol.mul(2n, this.gam2_k),
        );
      activeInfo.b0 = this._quadraticRoots(
        this.ind_0_a2,
        activeInfo.a1,
        activeInfo.a0,
      );
      activeInfo.L = MMath.mul(
        this.state.baseBalance - activeInfo.b0,
        MMath.mul(this.gamma_bar, su),
      );
      activeInfo.b1 = MMath.div(
        MMath.div(MMath.mul(this.h, activeInfo.L), su),
        this.gammas[1],
      );
      activeInfo.b2 = this.state.baseBalance - activeInfo.b0 - activeInfo.b1;
      activeInfo.q0 = this.state.quoteBalance;
      activeInfo.q1 = 0n;
      activeInfo.q2 = 0n;
    } else {
      activeInfo.a0 = MMath.mul(
        this.state.quoteBalance,
        MMath.mul(
          MMath.mul(this.state.baseBalance, this.state.u),
          MMath.mul(MMath.mul(this.w, this.lambda_bar), this.sk),
        ) + MMath.mul(this.state.quoteBalance, this.lam2_kw),
      );
      activeInfo.a1 =
        MMath.mul(
          MMath.mul(this.state.baseBalance, this.state.u),
          MMath.mul(this.sk, this.sw - MMath.mul(this.w, this.lambda_bar)),
        ) +
        MMath.mul(
          this.state.quoteBalance,
          this.lambda_bar - MMath.mul(BI_POWS[18] + BI_POWS[18], this.lam2_kw),
        );
      activeInfo.q2 = this._quadraticRoots(
        this.ind_2_a2,
        activeInfo.a1,
        activeInfo.a0,
      );
      activeInfo.L = MMath.div(
        MMath.mul(this.state.quoteBalance - activeInfo.q2, this.lambda_bar),
        su,
      );
      activeInfo.q0 = MMath.div(MMath.mul(activeInfo.L, su), this.lambdas[0]);
      activeInfo.q1 = this.state.quoteBalance - activeInfo.q0 - activeInfo.q2;
      activeInfo.b0 = 0n;
      activeInfo.b1 = 0n;
      activeInfo.b2 = this.state.baseBalance;
    }

    return {
      base: [activeInfo.b0, activeInfo.b1, activeInfo.b2],
      quote: [activeInfo.q0, activeInfo.q1, activeInfo.q2],
      L: activeInfo.L,
      activeInd: activeInd,
    };
  }

  _computeQuoteForBaseBin(quoteIn: bigint, binInd: number, assetInfo: any) {
    if (quoteIn < 0) {
      throw new Error(`Error_${this.dexKey}_Pool: Negative Swap`);
    }
    let binBase: bigint = assetInfo.base[binInd];
    let binQuote = assetInfo.quote[binInd];
    let L = assetInfo.L;

    if (binInd == 1) {
      L = MMath.mul(L, this.h);
    }

    let spHigh: bigint;
    let spLow: bigint;

    if (binInd == 0) {
      spHigh = MMath.sqrt(MMath.div(this.state.u, this.w));
      spLow = MMath.sqrt(MMath.div(MMath.div(this.state.u, this.w), this.k));
    } else if (binInd == 1) {
      spHigh = MMath.sqrt(MMath.mul(this.state.u, this.w));
      spLow = MMath.sqrt(MMath.div(this.state.u, this.w));
    } else {
      spHigh = MMath.sqrt(MMath.mul(MMath.mul(this.state.u, this.w), this.k));
      spLow = MMath.sqrt(MMath.mul(this.state.u, this.w));
    }

    let qo = MMath.mul(L, spLow);
    let bo = MMath.div(L, spHigh);
    let maxQuote: bigint = MMath.mul(L, spHigh) - qo;
    let excessQuote = MMath.max(0n, quoteIn + binQuote - maxQuote);
    let newPrice: bigint;
    let baseOut: bigint;

    if (excessQuote > 0n) {
      baseOut = binBase;
      newPrice = 0n;
    } else {
      const B = bo + binBase;
      const Q = binQuote + qo + quoteIn;
      baseOut = MMath.div(MMath.mul(B, quoteIn), Q);
      newPrice = MMath.div(Q, B - baseOut);
    }

    return {
      quoteDelta: quoteIn - excessQuote,
      baseDelta: -baseOut,
      excess: excessQuote,
      newPrice: newPrice,
    };
  }

  _computeBaseForQuoteBin(
    baseIn: bigint,
    binInd: number,
    assetInfo: any,
  ): ComputeInfo {
    if (baseIn < 0) {
      throw new Error(`Error_${this.dexKey}_Pool: Negative Swap`);
    }
    let binBase: bigint = assetInfo.base[binInd];
    let binQuote = assetInfo.quote[binInd];
    let L = assetInfo.L;
    if (binInd == 1) {
      L = MMath.mul(L, this.h);
    }

    let spHigh: bigint;
    let spLow: bigint;

    if (binInd == 0) {
      spHigh = MMath.sqrt(MMath.div(this.state.u, this.w));
      spLow = MMath.sqrt(MMath.div(MMath.div(this.state.u, this.w), this.k));
    } else if (binInd == 1) {
      spHigh = MMath.sqrt(MMath.mul(this.state.u, this.w));
      spLow = MMath.sqrt(MMath.div(this.state.u, this.w));
    } else {
      spHigh = MMath.sqrt(MMath.mul(MMath.mul(this.state.u, this.w), this.k));
      spLow = MMath.sqrt(MMath.mul(this.state.u, this.w));
    }

    let qo = MMath.mul(L, spLow);
    let bo = MMath.div(L, spHigh);
    let maxBase: bigint = MMath.div(L, spLow) - bo;
    let excessBase = MMath.max(0n, baseIn + binBase - maxBase);
    let newPrice: bigint;
    let quoteOut: bigint;

    if (excessBase > 0) {
      quoteOut = binQuote;
      newPrice = 0n;
    } else {
      const B = bo + binBase + baseIn;
      const Q = binQuote + qo;
      quoteOut = MMath.div(MMath.mul(Q, baseIn), B);
      newPrice = MMath.div(Q - quoteOut, B);
    }

    return {
      quoteDelta: -quoteOut,
      baseDelta: baseIn - excessBase,
      excess: excessBase,
      newPrice: newPrice,
    };
  }

  _boundaryCheck(
    assetInfo: any,
    swapInfo: any,
    currentInd: number,
    isQuote: boolean,
  ) {
    let alpha = BI_POWS[18] + MMath.mul(this.epsilon, this.w - BI_POWS[18]);

    if (isQuote) {
      const upperSlip = MMath.div(
        MMath.mul(this.h, alpha - BI_POWS[18]),
        this.sw,
      );
      const check =
        currentInd == 2 ||
        (currentInd == 1 &&
          assetInfo.quote[1] +
            swapInfo.quoteDelta -
            MMath.mul(
              MMath.mul(assetInfo.base[1] + swapInfo.baseDelta, this.state.u),
              alpha,
            ) >
            MMath.mul(
              MMath.mul(upperSlip, assetInfo.L),
              MMath.sqrt(this.state.u),
            ));
      return { check, alpha };
    } else {
      const lowerSlip = MMath.mul(
        this.h,
        MMath.div(MMath.div(BI_POWS[18], alpha) - BI_POWS[18], this.sw),
      );
      const check =
        currentInd == 0 ||
        (currentInd == 1 &&
          assetInfo.quote[1] +
            swapInfo.quoteDelta -
            MMath.div(
              MMath.mul(assetInfo.base[1] + swapInfo.baseDelta, this.state.u),
              alpha,
            ) <
            MMath.mul(
              MMath.mul(lowerSlip, assetInfo.L),
              MMath.sqrt(this.state.u),
            ));
      return { check, alpha };
    }
  }

  _swapQuoteForBase(quoteIn: bigint, doUUpdate: boolean): bigint {
    if (quoteIn < 0) {
      throw new Error(`Error_${this.dexKey}_Pool: Insufficient Swap`);
    }
    if (doUUpdate) {
      quoteIn = this._addFeeToEscrow(quoteIn, true);
    }

    const assetInfo = this._getAssetsInActiveBin();
    let currentInd = assetInfo.activeInd;
    const swapInfo = [
      this._computeQuoteForBaseBin(quoteIn, currentInd, assetInfo),
    ];
    let baseOut = -swapInfo[0].baseDelta;
    let counter = 0;

    while (true) {
      if (swapInfo[counter].excess == 0n) {
        break;
      }
      counter++;
      currentInd++;
      if (currentInd > 2) {
        throw new Error(`Error_${this.dexKey}_Pool: Not enough base`);
      }

      swapInfo[counter] = this._computeQuoteForBaseBin(
        swapInfo[counter - 1].excess,
        currentInd,
        assetInfo,
      );
      baseOut -= swapInfo[counter].baseDelta;
    }

    if (doUUpdate && this.uShiftMultiplier > 0) {
      let { check, alpha } = this._boundaryCheck(
        assetInfo,
        swapInfo[counter],
        currentInd,
        true,
      );

      if (check) {
        let edgePrice = MMath.mul(this.state.u, alpha);
        let newU = MMath.mul(
          BI_POWS[18] +
            MMath.mul(
              MMath.div(swapInfo[counter].newPrice - edgePrice, edgePrice),
              this.uShiftMultiplier,
            ),
          this.state.u,
        );
        this._updateU(newU);
        return this._swapQuoteForBase(quoteIn, false);
      }
    }
    this._executeSwap(swapInfo);
    return baseOut;
  }

  _swapBaseForQuote(amount: bigint, doUUpdate: boolean): bigint {
    if (doUUpdate) {
      amount = this._addFeeToEscrow(amount, false);
    }

    const assetInfo = this._getAssetsInActiveBin();
    let currentInd = assetInfo.activeInd;
    const swapInfo = [
      this._computeBaseForQuoteBin(amount, currentInd, assetInfo),
    ];
    let quoteOut = -swapInfo[0].quoteDelta;
    let counter = 0;

    while (true) {
      if (swapInfo[counter].excess == 0n) {
        break;
      }
      if (currentInd <= 0) {
        throw new Error(`Error_${this.dexKey}_Pool: Not enough quote`);
      }
      counter++;
      currentInd -= 1;

      swapInfo[counter] = this._computeBaseForQuoteBin(
        swapInfo[counter - 1].excess,
        currentInd,
        assetInfo,
      );

      quoteOut -= swapInfo[counter].quoteDelta;
    }

    if (doUUpdate && this.uShiftMultiplier > 0) {
      let { check, alpha } = this._boundaryCheck(
        assetInfo,
        swapInfo[counter],
        currentInd,
        false,
      );

      if (check) {
        let edgePrice = MMath.div(this.state.u, alpha);
        let newU = MMath.mul(
          BI_POWS[18] +
            MMath.mul(
              MMath.div(swapInfo[counter].newPrice - edgePrice, edgePrice),
              this.uShiftMultiplier,
            ),
          this.state.u,
        );
        this._updateU(newU);
        return this._swapBaseForQuote(amount, false);
      }
    }
    this._executeSwap(swapInfo);
    return quoteOut;
  }

  _executeSwap(swapInfo: any) {
    let _baseBalance = this.state.baseBalance;
    let _quoteBalance = this.state.quoteBalance;

    for (let i = 0; i < swapInfo.length; i++) {
      const swapInfoInstance = swapInfo[i];
      _baseBalance += swapInfoInstance.baseDelta;
      _quoteBalance += swapInfoInstance.quoteDelta;
    }

    this.state.baseBalance = _baseBalance;
    this.state.quoteBalance = _quoteBalance;
  }

  _updateU(newU: bigint) {
    if (newU <= 0) {
      throw new Error(`Error_${this.dexKey}_Pool: u out of bounds`);
    }
    if (this.state.lastTimestamp == 0n) {
      this.state.twau = newU;
    } else {
      this.state.twau = this._calculateTwau(this.state.u);
    }
    this.state.lastTimestamp = this._getTimestamp();
    this.state.u = newU;
  }
}
