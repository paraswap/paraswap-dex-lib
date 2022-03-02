import { Interface } from '@ethersproject/abi';
import { MathSol, BZERO } from './balancer-v2-math';
import { SwapSide } from '../../constants';
import { callData, SubgraphPoolBase, PoolState, TokenState } from './types';
import { getTokenScalingFactor } from './utils';
import WeightedPoolABI from '../../abi/balancer-v2/weighted-pool.json';
import StablePoolABI from '../../abi/balancer-v2/stable-pool.json';

const _require = (b: boolean, message: string) => {
  if (!b) throw new Error(message);
};

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
}

type WeightedPoolPairData = {
  tokenInBalance: BigInt;
  tokenOutBalance: BigInt;
  tokenInScalingFactor: BigInt;
  tokenOutScalingFactor: BigInt;
  tokenInWeight: BigInt;
  tokenOutWeight: BigInt;
  swapFee: BigInt;
};

type StablePoolPairData = {
  balances: BigInt[];
  indexIn: number;
  indexOut: number;
  scalingFactors: BigInt[];
  swapFee: BigInt;
  amp: BigInt;
};

abstract class BaseGeneralPool extends BasePool {
  // Swap Hooks

  // Modification: this is inspired from the function onSwap which is in the original contract
  onSell(
    amounts: bigint[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    _scalingFactors: bigint[],
    _swapFeePercentage: bigint,
    _amplificationParameter: bigint,
  ): bigint[] {
    // _validateIndexes(indexIn, indexOut, _getTotalTokens());
    // uint256[] memory scalingFactors = _scalingFactors();
    return this._swapGivenIn(
      amounts,
      balances,
      indexIn,
      indexOut,
      _scalingFactors,
      _swapFeePercentage,
      _amplificationParameter,
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
}

abstract class BaseMinimalSwapInfoPool extends BasePool {
  // Swap Hooks

  // Modification: this is inspired from the function onSwap which is in the original contract
  onSell(
    tokenAmountsIn: bigint[],
    balanceTokenIn: bigint,
    balanceTokenOut: bigint,
    _scalingFactorTokenIn: bigint,
    _scalingFactorTokenOut: bigint,
    _weightIn: bigint,
    _weightOut: bigint,
    _swapFeePercentage: bigint,
  ): bigint[] {
    // uint256 _scalingFactorTokenIn = _scalingFactor(request.tokenIn);
    // uint256 _scalingFactorTokenOut = _scalingFactor(request.tokenOut);

    // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
    const tokenAmountsInWithFee = tokenAmountsIn.map(a =>
      this._subtractSwapFeeAmount(a, _swapFeePercentage),
    );

    // All token amounts are upscaled.
    balanceTokenIn = this._upscale(balanceTokenIn, _scalingFactorTokenIn);
    balanceTokenOut = this._upscale(balanceTokenOut, _scalingFactorTokenOut);
    const tokenAmountsInScaled = tokenAmountsInWithFee.map(a =>
      this._upscale(a, _scalingFactorTokenIn),
    );

    const amountsOut = this._onSwapGivenIn(
      tokenAmountsInScaled,
      balanceTokenIn,
      balanceTokenOut,
      _weightIn,
      _weightOut,
    );

    // amountOut tokens are exiting the Pool, so we round down.
    return amountsOut.map(a => this._downscaleDown(a, _scalingFactorTokenOut));
  }

  abstract _onSwapGivenIn(
    tokenAmountsIn: bigint[],
    currentBalanceTokenIn: bigint,
    currentBalanceTokenOut: bigint,
    _weightIn: bigint,
    _weightOut: bigint,
  ): bigint[];
}

class StableMath {
  static _AMP_PRECISION = BigInt(1e3);

  static _calculateInvariant(
    amplificationParameter: bigint,
    balances: bigint[],
    roundUp: boolean,
  ): bigint {
    /**********************************************************************************************
      // invariant                                                                                 //
      // D = invariant                                                  D^(n+1)                    //
      // A = amplification coefficient      A  n^n S + D = A D n^n + -----------                   //
      // S = sum of balances                                             n^n P                     //
      // P = product of balances                                                                   //
      // n = number of tokens                                                                      //
      *********x************************************************************************************/

    // We support rounding up or down.

    let sum = BZERO;
    const numTokens = balances.length;
    for (let i = 0; i < numTokens; i++) {
      sum = sum + balances[i];
    }
    if (sum == BZERO) {
      return BZERO;
    }

    let prevInvariant = BZERO;
    let invariant = sum;
    const ampTimesTotal = amplificationParameter * BigInt(numTokens);

    for (let i = 0; i < 255; i++) {
      let P_D = balances[0] * BigInt(numTokens);
      for (let j = 1; j < numTokens; j++) {
        P_D = MathSol.div(
          MathSol.mul(MathSol.mul(P_D, balances[j]), BigInt(numTokens)),
          invariant,
          roundUp,
        );
      }
      prevInvariant = invariant;
      invariant = MathSol.div(
        MathSol.mul(MathSol.mul(BigInt(numTokens), invariant), invariant) +
          MathSol.div(
            MathSol.mul(MathSol.mul(ampTimesTotal, sum), P_D),
            this._AMP_PRECISION,
            roundUp,
          ),
        MathSol.mul(BigInt(numTokens + 1), invariant) +
          // No need to use checked arithmetic for the amp precision, the amp is guaranteed to be at least 1
          MathSol.div(
            MathSol.mul(ampTimesTotal - this._AMP_PRECISION, P_D),
            this._AMP_PRECISION,
            !roundUp,
          ),
        roundUp,
      );

      if (invariant > prevInvariant) {
        if (invariant - prevInvariant <= 1) {
          return invariant;
        }
      } else if (prevInvariant - invariant <= 1) {
        return invariant;
      }
    }

    throw new Error('Errors.STABLE_INVARIANT_DIDNT_CONVERGE');
  }

  static _calcOutGivenIn(
    amplificationParameter: bigint,
    balances: bigint[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountsIn: bigint[],
  ): bigint[] {
    /**************************************************************************************************************
    // outGivenIn token x for y - polynomial equation to solve                                                   //
    // ay = amount out to calculate                                                                              //
    // by = balance token out                                                                                    //
    // y = by - ay (finalBalanceOut)                                                                             //
    // D = invariant                                               D                     D^(n+1)                 //
    // A = amplification coefficient               y^2 + ( S - ----------  - D) * y -  ------------- = 0         //
    // n = number of tokens                                    (A * n^n)               A * n^2n * P              //
    // S = sum of final balances but y                                                                           //
    // P = product of final balances but y                                                                       //
    **************************************************************************************************************/

    // Amount out, so we round down overall.

    // Given that we need to have a greater final balance out, the invariant needs to be rounded up
    const invariant = this._calculateInvariant(
      amplificationParameter,
      balances,
      true,
    );

    const initBalance = balances[tokenIndexIn];
    // Modification: The original code was implemented for a single tokenAmountsIn
    return tokenAmountsIn.map(a => {
      balances[tokenIndexIn] = initBalance + a;

      const finalBalanceOut =
        this._getTokenBalanceGivenInvariantAndAllOtherBalances(
          amplificationParameter,
          balances,
          invariant,
          tokenIndexOut,
        );

      // No need to use checked arithmetic since `tokenAmountIn` was actually added to the same balance right before
      // calling `_getTokenBalanceGivenInvariantAndAllOtherBalances` which doesn't alter the balances array.
      // balances[tokenIndexIn] = balances[tokenIndexIn] - tokenAmountIn;
      return balances[tokenIndexOut] - finalBalanceOut - BigInt(1);
    });
  }

  static _getTokenBalanceGivenInvariantAndAllOtherBalances(
    amplificationParameter: bigint,
    balances: bigint[],
    invariant: bigint,
    tokenIndex: number,
  ): bigint {
    // Rounds result up overall

    const ampTimesTotal = amplificationParameter * BigInt(balances.length);
    let sum = balances[0];
    let P_D = balances[0] * BigInt(balances.length);
    for (let j = 1; j < balances.length; j++) {
      P_D = MathSol.divDown(
        MathSol.mul(MathSol.mul(P_D, balances[j]), BigInt(balances.length)),
        invariant,
      );
      sum = sum + balances[j];
    }
    // No need to use safe math, based on the loop above `sum` is greater than or equal to `balances[tokenIndex]`
    sum = sum - balances[tokenIndex];

    const inv2 = MathSol.mul(invariant, invariant);
    // We remove the balance fromm c by multiplying it
    const c = MathSol.mul(
      MathSol.mul(
        MathSol.divUp(inv2, MathSol.mul(ampTimesTotal, P_D)),
        this._AMP_PRECISION,
      ),
      balances[tokenIndex],
    );
    const b =
      sum +
      MathSol.mul(
        MathSol.divDown(invariant, ampTimesTotal),
        this._AMP_PRECISION,
      );

    // We iterate to find the balance
    let prevTokenBalance = BZERO;
    // We multiply the first iteration outside the loop with the invariant to set the value of the
    // initial approximation.
    let tokenBalance = MathSol.divUp(inv2 + c, invariant + b);

    for (let i = 0; i < 255; i++) {
      prevTokenBalance = tokenBalance;

      tokenBalance = MathSol.divUp(
        MathSol.mul(tokenBalance, tokenBalance) + c,
        MathSol.mul(tokenBalance, BigInt(2)) + b - invariant,
      );

      if (tokenBalance > prevTokenBalance) {
        if (tokenBalance - prevTokenBalance <= 1) {
          return tokenBalance;
        }
      } else if (prevTokenBalance - tokenBalance <= 1) {
        return tokenBalance;
      }
    }

    throw new Error('Errors.STABLE_GET_BALANCE_DIDNT_CONVERGE');
  }
}

export class StablePool extends BaseGeneralPool {
  _onSwapGivenIn(
    tokenAmountsIn: bigint[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    _amplificationParameter: bigint,
  ): bigint[] {
    return StableMath._calcOutGivenIn(
      _amplificationParameter,
      balances,
      indexIn,
      indexOut,
      tokenAmountsIn,
    );
  }

  /*
  Helper function to parse pool data into params for onSell function.
  */
  parsePoolPairData(
    pool: SubgraphPoolBase,
    poolState: PoolState,
    tokenIn: string,
    tokenOut: string,
    isMetaStable: boolean,
  ): StablePoolPairData {
    let indexIn = 0,
      indexOut = 0;
    const scalingFactors: BigInt[] = [];
    const balances = pool.tokens.map((t, i) => {
      if (t.address.toLowerCase() === tokenIn.toLowerCase()) indexIn = i;
      if (t.address.toLowerCase() === tokenOut.toLowerCase()) indexOut = i;
      if (isMetaStable)
        scalingFactors.push(
          poolState.tokens[t.address.toLowerCase()].scalingFactor || BigInt(0),
        );
      else scalingFactors.push(getTokenScalingFactor(t.decimals));
      return poolState.tokens[t.address.toLowerCase()].balance;
    });

    const poolPairData: StablePoolPairData = {
      balances,
      indexIn,
      indexOut,
      scalingFactors,
      swapFee: poolState.swapFee,
      amp: poolState.amp ? poolState.amp : BigInt(0),
    };
    return poolPairData;
  }

  /*
  Helper function to construct onchain multicall data for StablePool.
  */
  static getOnChainCalls(
    pool: SubgraphPoolBase,
    vaultAddress: string,
    vaultInterface: Interface,
  ): callData[] {
    const poolInterface = new Interface(StablePoolABI);

    return [
      {
        target: vaultAddress,
        callData: vaultInterface.encodeFunctionData('getPoolTokens', [pool.id]),
      },
      {
        target: pool.address,
        callData: poolInterface.encodeFunctionData('getSwapFeePercentage'),
      },
      {
        target: pool.address,
        callData: poolInterface.encodeFunctionData('getAmplificationParameter'),
      },
    ];
  }

  /*
  Helper function to decodes multicall data for a Stable Pool.
  data must contain returnData
  startIndex is where to start in returnData. Allows this decode function to be called along with other pool types.
  */
  static decodeOnChainCalls(
    pool: SubgraphPoolBase,
    vaultInterface: Interface,
    data: any,
    startIndex: number,
  ): [{ [address: string]: PoolState }, number] {
    const poolInterface = new Interface(StablePoolABI);

    const pools = {} as { [address: string]: PoolState };

    const poolTokens = vaultInterface.decodeFunctionResult(
      'getPoolTokens',
      data.returnData[startIndex++],
    );

    const swapFee = poolInterface.decodeFunctionResult(
      'getSwapFeePercentage',
      data.returnData[startIndex++],
    )[0];

    const amp = poolInterface.decodeFunctionResult(
      'getAmplificationParameter',
      data.returnData[startIndex++],
    );

    const poolState: PoolState = {
      swapFee: BigInt(swapFee.toString()),
      tokens: poolTokens.tokens.reduce(
        (ptAcc: { [address: string]: TokenState }, pt: string, j: number) => {
          const tokenState: TokenState = {
            balance: BigInt(poolTokens.balances[j].toString()),
          };

          ptAcc[pt.toLowerCase()] = tokenState;
          return ptAcc;
        },
        {},
      ),
    };

    if (amp) {
      poolState.amp = BigInt(amp.value.toString());
    }

    pools[pool.address] = poolState;

    return [pools, startIndex];
  }

  /*
  For stable pools there is no Swap limit. As an approx - use almost the total balance of token out as we can add any amount of tokenIn and expect some back.
  */
  checkBalance(
    balanceOut: bigint,
    scalingFactor: bigint,
    amounts: bigint[],
    unitVolume: bigint,
  ): boolean {
    const swapMax =
      (this._upscale(balanceOut, scalingFactor) * BigInt(99)) / BigInt(100);
    const swapAmount =
      amounts[amounts.length - 1] > unitVolume
        ? amounts[amounts.length - 1]
        : unitVolume;
    return swapMax > swapAmount;
  }
}

export class WeightedMath {
  static _MAX_IN_RATIO = BigInt(300000000000000000);
  static _MAX_OUT_RATIO = BigInt(300000000000000000);
  // Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
  // current balances and weights.
  static _calcOutGivenIn(
    balanceIn: bigint,
    weightIn: bigint,
    balanceOut: bigint,
    weightOut: bigint,
    amountsIn: bigint[],
  ): bigint[] {
    /**********************************************************************************************
    // outGivenIn                                                                                //
    // aO = amountOut                                                                            //
    // bO = balanceOut                                                                           //
    // bI = balanceIn              /      /            bI             \    (wI / wO) \           //
    // aI = amountIn    aO = bO * |  1 - | --------------------------  | ^            |          //
    // wI = weightIn               \      \       ( bI + aI )         /              /           //
    // wO = weightOut                                                                            //
    **********************************************************************************************/

    // Amount out, so we round down overall.

    // The multiplication rounds down, and the subtrahend (power) rounds up (so the base rounds up too).
    // Because bI / (bI + aI) <= 1, the exponent rounds down.

    // Cannot exceed maximum in ratio

    const exponent = MathSol.divDownFixed(weightIn, weightOut);
    return amountsIn.map(amountIn => {
      _require(
        amountIn <= MathSol.mulDownFixed(balanceIn, this._MAX_IN_RATIO),
        'Errors.MAX_IN_RATIO',
      );
      const denominator = balanceIn + amountIn;
      const base = MathSol.divUpFixed(balanceIn, denominator);
      const power = MathSol.powUpFixed(base, exponent);

      return MathSol.mulDownFixed(balanceOut, MathSol.complementFixed(power));
    });
  }
}

export class WeightedPool extends BaseMinimalSwapInfoPool {
  _onSwapGivenIn(
    tokenAmountsIn: bigint[],
    currentBalanceTokenIn: bigint,
    currentBalanceTokenOut: bigint,
    _weightIn: bigint,
    _weightOut: bigint,
  ): bigint[] {
    return WeightedMath._calcOutGivenIn(
      currentBalanceTokenIn,
      _weightIn,
      currentBalanceTokenOut,
      _weightOut,
      tokenAmountsIn,
    );
  }

  /*
  Helper function to parse pool data into params for onSell function.
  */
  parsePoolPairData(
    pool: SubgraphPoolBase,
    poolState: PoolState,
    tokenIn: string,
    tokenOut: string,
  ): WeightedPoolPairData {
    const inAddress = tokenIn.toLowerCase();
    const outAddress = tokenOut.toLowerCase();

    const tIn = pool.tokens.find(t => t.address.toLowerCase() === inAddress);
    const tOut = pool.tokens.find(t => t.address.toLowerCase() === outAddress);

    if (!tIn || !tOut) return {} as WeightedPoolPairData;

    const tokenInBalance = poolState.tokens[inAddress].balance;
    const tokenOutBalance = poolState.tokens[outAddress].balance;
    const tokenInWeight = poolState.tokens[inAddress].weight || BigInt(0);
    const tokenOutWeight = poolState.tokens[outAddress].weight || BigInt(0);
    const tokenInScalingFactor = getTokenScalingFactor(tIn.decimals);
    const tokenOutScalingFactor = getTokenScalingFactor(tOut.decimals);

    const poolPairData: WeightedPoolPairData = {
      tokenInBalance,
      tokenOutBalance,
      tokenInScalingFactor,
      tokenOutScalingFactor,
      tokenInWeight,
      tokenOutWeight,
      swapFee: poolState.swapFee,
    };
    return poolPairData;
  }

  /*
  Helper function to construct onchain multicall data for WeightedPool (also 'LiquidityBootstrapping' and 'Investment' pool types).
  */
  static getOnChainCalls(
    pool: SubgraphPoolBase,
    vaultAddress: string,
    vaultInterface: Interface,
  ): callData[] {
    const poolInterface = new Interface(WeightedPoolABI);
    return [
      {
        target: vaultAddress,
        callData: vaultInterface.encodeFunctionData('getPoolTokens', [pool.id]),
      },
      {
        target: pool.address,
        callData: poolInterface.encodeFunctionData('getSwapFeePercentage'),
      },
      {
        target: pool.address,
        callData: poolInterface.encodeFunctionData('getNormalizedWeights'),
      },
    ];
  }

  /*
  Helper function to decodes multicall data for a Weighted Pool.
  data must contain returnData
  startIndex is where to start in returnData. Allows this decode function to be called along with other pool types.
  */
  static decodeOnChainCalls(
    pool: SubgraphPoolBase,
    vaultInterface: Interface,
    data: any,
    startIndex: number,
  ): [{ [address: string]: PoolState }, number] {
    const poolInterface = new Interface(WeightedPoolABI);

    const pools = {} as { [address: string]: PoolState };

    const poolTokens = vaultInterface.decodeFunctionResult(
      'getPoolTokens',
      data.returnData[startIndex++],
    );

    const swapFee = poolInterface.decodeFunctionResult(
      'getSwapFeePercentage',
      data.returnData[startIndex++],
    )[0];

    const normalisedWeights = poolInterface.decodeFunctionResult(
      'getNormalizedWeights',
      data.returnData[startIndex++],
    )[0];

    const poolState: PoolState = {
      swapFee: BigInt(swapFee.toString()),
      tokens: poolTokens.tokens.reduce(
        (ptAcc: { [address: string]: TokenState }, pt: string, j: number) => {
          const tokenState: TokenState = {
            balance: BigInt(poolTokens.balances[j].toString()),
          };

          if (normalisedWeights)
            tokenState.weight = BigInt(normalisedWeights[j].toString());

          ptAcc[pt.toLowerCase()] = tokenState;
          return ptAcc;
        },
        {},
      ),
    };

    pools[pool.address] = poolState;

    return [pools, startIndex];
  }

  /*
  For weighted pools there is a Swap limit of 30%: amounts swapped may not be larger than this percentage of total balance.
  */
  checkBalance(
    balanceIn: bigint,
    balanceOut: bigint,
    side: SwapSide,
    amounts: bigint[],
    unitVolume: bigint,
  ): boolean {
    const swapMax =
      ((side === SwapSide.SELL ? balanceIn : balanceOut) * BigInt(3)) /
      BigInt(10);
    const swapAmount =
      amounts[amounts.length - 1] > unitVolume
        ? amounts[amounts.length - 1]
        : unitVolume;
    return swapMax > swapAmount;
  }
}
