import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';
import { MathSol } from './balancer-v2-math';
import { SwapSide } from '../../constants';
import { callData, SubgraphPoolBase, PoolState, TokenState } from './types';
import { getTokenScalingFactor, decodeThrowError } from './utils';
import WeightedPoolABI from '../../abi/balancer-v2/weighted-pool.json';
import StablePoolABI from '../../abi/balancer-v2/stable-pool.json';
import MetaStablePoolABI from '../../abi/balancer-v2/meta-stable-pool.json';
import { BI_POWS } from '../../bigint-constants';
import { assert } from 'ts-essentials';

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

  _nullifyIfMaxAmountExceeded(amountToTrade: bigint, swapMax: bigint): bigint {
    return swapMax >= amountToTrade ? amountToTrade : 0n;
  }
}

type WeightedPoolPairData = {
  tokenInBalance: bigint;
  tokenOutBalance: bigint;
  tokenInScalingFactor: bigint;
  tokenOutScalingFactor: bigint;
  tokenInWeight: bigint;
  tokenOutWeight: bigint;
  swapFee: bigint;
};

type StablePoolPairData = {
  balances: bigint[];
  indexIn: number;
  indexOut: number;
  scalingFactors: bigint[];
  swapFee: bigint;
  amp: bigint;
};

abstract class BaseGeneralPool extends BasePool {
  // Swap Hooks

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
}

class StableMath {
  static _AMP_PRECISION = BI_POWS[3];

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

    let sum = 0n;
    const numTokens = balances.length;
    for (let i = 0; i < numTokens; i++) {
      sum = sum + balances[i];
    }
    if (sum == 0n) {
      return 0n;
    }

    let prevInvariant = 0n;
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
      return balances[tokenIndexOut] - finalBalanceOut - 1n;
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
    let prevTokenBalance = 0n;
    // We multiply the first iteration outside the loop with the invariant to set the value of the
    // initial approximation.
    let tokenBalance = MathSol.divUp(inv2 + c, invariant + b);

    for (let i = 0; i < 255; i++) {
      prevTokenBalance = tokenBalance;

      tokenBalance = MathSol.divUp(
        MathSol.mul(tokenBalance, tokenBalance) + c,
        MathSol.mul(tokenBalance, 2n) + b - invariant,
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
  vaultAddress: string;
  vaultInterface: Interface;
  poolInterface: Interface;
  metaPoolInterface: Interface;

  constructor(vaultAddress: string, vaultInterface: Interface) {
    super();
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
    this.poolInterface = new Interface(StablePoolABI);
    this.metaPoolInterface = new Interface(MetaStablePoolABI);
  }

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
  ): StablePoolPairData {
    let indexIn = 0,
      indexOut = 0;
    const scalingFactors: bigint[] = [];
    const balances = poolState.orderedTokens.map((tokenAddress, i) => {
      const t = pool.tokensMap[tokenAddress.toLowerCase()];
      if (t.address.toLowerCase() === tokenIn.toLowerCase()) indexIn = i;
      if (t.address.toLowerCase() === tokenOut.toLowerCase()) indexOut = i;
      if (pool.poolType === 'MetaStable')
        scalingFactors.push(
          poolState.tokens[t.address.toLowerCase()].scalingFactor || 0n,
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
      amp: poolState.amp ? poolState.amp : 0n,
    };
    return poolPairData;
  }

  /*
  Helper function to construct onchain multicall data for StablePool.
  */
  getOnChainCalls(pool: SubgraphPoolBase): callData[] {
    const poolCallData: callData[] = [
      {
        target: this.vaultAddress,
        callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
          pool.id,
        ]),
      },
      {
        target: pool.address,
        callData: this.poolInterface.encodeFunctionData('getSwapFeePercentage'),
      },
      {
        target: pool.address,
        callData: this.poolInterface.encodeFunctionData(
          'getAmplificationParameter',
        ),
      },
    ];
    if (pool.poolType === 'MetaStable') {
      poolCallData.push({
        target: pool.address,
        callData:
          this.metaPoolInterface.encodeFunctionData('getScalingFactors'),
      });
    }
    return poolCallData;
  }

  /*
  Helper function to decodes multicall data for a Stable Pool.
  data must contain returnData
  startIndex is where to start in returnData. Allows this decode function to be called along with other pool types.
  */
  decodeOnChainCalls(
    pool: SubgraphPoolBase,
    data: { success: boolean; returnData: any }[],
    startIndex: number,
  ): [{ [address: string]: PoolState }, number] {
    const pools = {} as { [address: string]: PoolState };

    const poolTokens = decodeThrowError(
      this.vaultInterface,
      'getPoolTokens',
      data[startIndex++],
      pool.address,
    );
    const swapFee = decodeThrowError(
      this.poolInterface,
      'getSwapFeePercentage',
      data[startIndex++],
      pool.address,
    )[0];
    const amp = decodeThrowError(
      this.poolInterface,
      'getAmplificationParameter',
      data[startIndex++],
      pool.address,
    );
    let scalingFactors: BigNumber[] | undefined;
    if (pool.poolType === 'MetaStable') {
      scalingFactors = decodeThrowError(
        this.metaPoolInterface,
        'getScalingFactors',
        data[startIndex++],
        pool.address,
      )[0];
    }

    const poolState: PoolState = {
      swapFee: BigInt(swapFee.toString()),
      tokens: poolTokens.tokens.reduce(
        (ptAcc: { [address: string]: TokenState }, pt: string, j: number) => {
          const tokenState: TokenState = {
            balance: BigInt(poolTokens.balances[j].toString()),
          };

          if (scalingFactors)
            tokenState.scalingFactor = BigInt(scalingFactors[j].toString());

          ptAcc[pt.toLowerCase()] = tokenState;
          return ptAcc;
        },
        {},
      ),
      orderedTokens: poolTokens.tokens,
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
  getSwapMaxAmount(poolPairData: StablePoolPairData, side: SwapSide): bigint {
    return (
      (this._upscale(
        poolPairData.balances[poolPairData.indexOut],
        poolPairData.scalingFactors[poolPairData.indexOut],
      ) *
        99n) /
      100n
    );
  }
}

export class WeightedMath {
  static _MAX_IN_RATIO = 300000000000000000n;
  static _MAX_OUT_RATIO = 300000000000000000n;
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
  vaultAddress: string;
  vaultInterface: Interface;
  poolInterface: Interface;

  constructor(vaultAddress: string, vaultInterface: Interface) {
    super();
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
    this.poolInterface = new Interface(WeightedPoolABI);
  }

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
    const tokenInWeight = poolState.tokens[inAddress].weight || 0n;
    const tokenOutWeight = poolState.tokens[outAddress].weight || 0n;
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
  getOnChainCalls(pool: SubgraphPoolBase): callData[] {
    return [
      {
        target: this.vaultAddress,
        callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
          pool.id,
        ]),
      },
      {
        target: pool.address,
        callData: this.poolInterface.encodeFunctionData('getSwapFeePercentage'),
      },
      {
        target: pool.address,
        callData: this.poolInterface.encodeFunctionData('getNormalizedWeights'),
      },
    ];
  }

  /*
  Helper function to decodes multicall data for a Weighted Pool.
  data must contain returnData
  startIndex is where to start in returnData. Allows this decode function to be called along with other pool types.
  */
  decodeOnChainCalls(
    pool: SubgraphPoolBase,
    data: { success: boolean; returnData: any }[],
    startIndex: number,
  ): [{ [address: string]: PoolState }, number] {
    const pools = {} as { [address: string]: PoolState };

    const poolTokens = decodeThrowError(
      this.vaultInterface,
      'getPoolTokens',
      data[startIndex++],
      pool.address,
    );
    const swapFee = decodeThrowError(
      this.poolInterface,
      'getSwapFeePercentage',
      data[startIndex++],
      pool.address,
    )[0];
    const normalisedWeights = decodeThrowError(
      this.poolInterface,
      'getNormalizedWeights',
      data[startIndex++],
      pool.address,
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
      orderedTokens: poolTokens.tokens,
    };

    pools[pool.address] = poolState;

    return [pools, startIndex];
  }

  /*
  For weighted pools there is a Swap limit of 30%: amounts swapped may not be larger than this percentage of total balance.
  */
  getSwapMaxAmount(poolPairData: WeightedPoolPairData, side: SwapSide): bigint {
    return (
      ((side === SwapSide.SELL
        ? poolPairData.tokenInBalance
        : poolPairData.tokenOutBalance) *
        3n) /
      10n
    );
  }
}
