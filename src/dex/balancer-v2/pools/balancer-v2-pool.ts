import { MathSol } from '../balancer-v2-math';
import { WeightedPoolPairData } from './weighted/WeightedPool';
import { StablePoolPairData } from './stable/StablePool';

export class BasePool {
  _subtractSwapFeeAmount(amount: bigint, _swapFeePercentage: bigint): bigint {
    // This returns amount - fee amount, so we round up (favoring a higher fee amount).
    const feeAmount = MathSol.mulUpFixed(amount, _swapFeePercentage);
    return amount - feeAmount;
  }

  // These methods use fixed versions to match SC scaling
  _upscaleArray(amounts: bigint[], scalingFactors: bigint[]): bigint[] {
    return amounts.map((a, i) => MathSol.mulUpFixed(a, scalingFactors[i]));
  }

  _upscale(amount: bigint, scalingFactor: bigint): bigint {
    return MathSol.mulUpFixed(amount, scalingFactor);
  }

  _downscaleDown(amount: bigint, scalingFactor: bigint): bigint {
    return MathSol.divDownFixed(amount, scalingFactor);
  }

  _downscaleUp(amount: bigint, scalingFactor: bigint): bigint {
    return MathSol.divUpFixed(amount, scalingFactor);
  }

  _nullifyIfMaxAmountExceeded(amountToTrade: bigint, swapMax: bigint): bigint {
    return swapMax >= amountToTrade ? amountToTrade : 0n;
  }
}


export abstract class BaseGeneralPool extends BasePool {

  // Swap Hooks
  onBuy(amounts: bigint[], poolPairData: StablePoolPairData): bigint[] {
    return this._swapGivenOut(
      amounts,
      poolPairData.balances,
      poolPairData.indexIn,
      poolPairData.indexOut,
      poolPairData.scalingFactors,
      poolPairData.swapFee,
      poolPairData.amp,
    );
  }

  // Modification: this is inspired from the function onSwap which is in the original contract
  onSell(amounts: bigint[], poolPairData: StablePoolPairData): bigint[] {
    // _validateIndexes(indexIn, indexOut, _getTotalTokens());
    // uint256[] memory scalingFactors = _scalingFactors();
    return this._swapGivenIn(
      amounts,
      poolPairData.balances,
      poolPairData.indexIn,
      poolPairData.indexOut,
      poolPairData.scalingFactors,
      poolPairData.swapFee,
      poolPairData.amp,
    );
  }

  _swapGivenIn(
    tokenAmountsIn: bigint[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    scalingFactors: bigint[],
    _swapFeePercentage: bigint,
    _amplificationParameter: bigint,
  ): bigint[] {
    // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
    const tokenAmountsInWithFee = tokenAmountsIn.map(a =>
      this._subtractSwapFeeAmount(a, _swapFeePercentage),
    );

    const balancesUpscaled = this._upscaleArray(balances, scalingFactors);
    const tokenAmountsInScaled = tokenAmountsInWithFee.map(a =>
      this._upscale(a, scalingFactors[indexIn]),
    );

    const amountsOut = this._onSwapGivenIn(
      tokenAmountsInScaled,
      balancesUpscaled,
      indexIn,
      indexOut,
      _amplificationParameter,
    );

    // amountOut tokens are exiting the Pool, so we round down.
    return amountsOut.map(a =>
      this._downscaleDown(a, scalingFactors[indexOut]),
    );
  }

  _swapGivenOut(
    tokenAmountsOut: bigint[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    scalingFactors: bigint[],
    _swapFeePercentage: bigint,
    _amplificationParameter: bigint,
  ): bigint[] {

    const balancesUpscaled = this._upscaleArray(balances, scalingFactors);
    const tokenAmountsOutScaled = tokenAmountsOut.map(a =>
      this._upscale(a, scalingFactors[indexOut]),
    );

    let amountsIn: bigint[];
    try {
      amountsIn = this._onSwapGivenOut(
        tokenAmountsOutScaled,
        balancesUpscaled,
        indexIn,
        indexOut,
        _amplificationParameter,
      );
    } catch (e) {
      amountsIn = new Array(tokenAmountsOut.length).fill(
        0n,
      );
    }

    // amountIn tokens are entering the Pool, so we round up.
    const amountsInDownscaled = amountsIn.map(a =>
      this._downscaleUp(a, scalingFactors[indexIn]),
    );

    // Fees are added after scaling happens, to reduce the complexity of the rounding direction analysis.
    return amountsInDownscaled.map(a =>
      this._subtractSwapFeeAmount(a, _swapFeePercentage),
    );
  }

  /*
   * @dev Called when a swap with the Pool occurs, where the amount of tokens entering the Pool is known.
   *
   * Returns the amount of tokens that will be taken from the Pool in return.
   *
   * All amounts inside `swapRequest` and `balances` are upscaled. The swap fee has already been deducted from
   * `swapRequest.amount`.
   *
   * The return value is also considered upscaled, and will be downscaled (rounding down) before returning it to the
   * Vault.
   */
  abstract _onSwapGivenIn(
    tokenAmountsIn: bigint[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    _amplificationParameter: bigint,
  ): bigint[];

  abstract _onSwapGivenOut(
    tokenAmountsOut: bigint[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    _amplificationParameter: bigint,
  ): bigint[];
}

export abstract class BaseMinimalSwapInfoPool extends BasePool {
  // Swap Hooks

  // This is inspired from the function onSwap which is in the original contract
  onBuy(
    tokenAmountsOut: bigint[],
    poolPairData: WeightedPoolPairData,
  ): bigint[] {
    // uint256 scalingFactorTokenIn = _scalingFactor(request.tokenIn);
    // uint256 scalingFactorTokenOut = _scalingFactor(request.tokenOut);

    // All token amounts are upscaled.
    const balanceTokenIn = this._upscale(
      poolPairData.tokenInBalance,
      poolPairData.tokenInScalingFactor,
    );

    const balanceTokenOut = this._upscale(
      poolPairData.tokenOutBalance,
      poolPairData.tokenOutScalingFactor,
    );

    const tokenAmountsOutScaled = tokenAmountsOut.map(a =>
      this._upscale(a, poolPairData.tokenOutScalingFactor),
    );

    let amountsIn: bigint[];
    try {
      amountsIn = this._onSwapGivenOut(
        tokenAmountsOutScaled,
        balanceTokenIn,
        balanceTokenOut,
        poolPairData.tokenInWeight,
        poolPairData.tokenOutWeight,
      );
    } catch (e) {
      amountsIn = new Array(tokenAmountsOut.length).fill(
        0n,
      );
    }

    const amountsInDownscaled = amountsIn.map(a =>
      this._downscaleUp(a, poolPairData.tokenInScalingFactor),
    );

    return amountsInDownscaled.map(a =>
      this._subtractSwapFeeAmount(a, poolPairData.swapFee),
    );
  }

  // Modification: this is inspired from the function onSwap which is in the original contract
  onSell(
    tokenAmountsIn: bigint[],
    poolPairData: WeightedPoolPairData,
  ): bigint[] {
    // uint256 _scalingFactorTokenIn = _scalingFactor(request.tokenIn);
    // uint256 _scalingFactorTokenOut = _scalingFactor(request.tokenOut);

    // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
    const tokenAmountsInWithFee = tokenAmountsIn.map(a =>
      this._subtractSwapFeeAmount(a, poolPairData.swapFee),
    );

    // All token amounts are upscaled.
    const balanceTokenIn = this._upscale(
      poolPairData.tokenInBalance,
      poolPairData.tokenInScalingFactor,
    );
    const balanceTokenOut = this._upscale(
      poolPairData.tokenOutBalance,
      poolPairData.tokenOutScalingFactor,
    );
    const tokenAmountsInScaled = tokenAmountsInWithFee.map(a =>
      this._upscale(a, poolPairData.tokenInScalingFactor),
    );

    const amountsOut = this._onSwapGivenIn(
      tokenAmountsInScaled,
      balanceTokenIn,
      balanceTokenOut,
      poolPairData.tokenInWeight,
      poolPairData.tokenOutWeight,
    );

    // amountOut tokens are exiting the Pool, so we round down.
    return amountsOut.map(a =>
      this._downscaleDown(a, poolPairData.tokenOutScalingFactor),
    );
  }

  abstract _onSwapGivenIn(
    tokenAmountsIn: bigint[],
    currentBalanceTokenIn: bigint,
    currentBalanceTokenOut: bigint,
    _weightIn: bigint,
    _weightOut: bigint,
  ): bigint[];

  abstract _onSwapGivenOut(
    tokenAmountsOut: bigint[],
    currentBalanceTokenIn: bigint,
    currentBalanceTokenOut: bigint,
    _weightIn: bigint,
    _weightOut: bigint,
  ): bigint[];
}

