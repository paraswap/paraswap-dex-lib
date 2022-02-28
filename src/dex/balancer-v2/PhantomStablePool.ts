import { BigNumber } from '@ethersproject/bignumber';
import { BasePool } from './balancer-v2-pool';
import { isSameAddress } from './utils';
import * as StableMath from './StableMath';
import { BZERO } from './balancer-v2-math';
import { SubgraphPoolBase, PoolState } from './types';
import { getTokenScalingFactor } from './utils';

enum PairTypes {
  BptToToken,
  TokenToBpt,
  TokenToToken,
}

type PhantomStablePoolPairData = {
  tokens: string[];
  balances: BigInt[];
  indexIn: number;
  indexOut: number;
  scalingFactors: BigInt[];
  bptIndex: number;
  swapFee: BigInt;
  amp: BigInt;
};

/*
/**
 * StablePool with preminted BPT and rate providers for each token, allowing for e.g. wrapped tokens with a known
 * price ratio, such as Compound's cTokens.
 * BPT is preminted on Pool initialization and registered as one of the Pool's tokens, allowing for swaps to behave as
 * single-token joins or exits (by swapping a token for BPT). Regular joins and exits are disabled, since no BPT is
 * minted or burned after initialization.
 * Preminted BPT is sometimes called Phantom BPT, as the preminted BPT (which is deposited in the Vault as balance of
 * the Pool) doesn't belong to any entity until transferred out of the Pool. The Pool's arithmetic behaves as if it
 * didn't exist, and the BPT total supply is not a useful value: we rely on the 'virtual supply' (how much BPT is
 * actually owned by some entity) instead.
 */
export class PhantomStablePool extends BasePool {
  // This is the maximum token amount the Vault can hold. In regular operation, the total BPT supply remains constant
  // and equal to _INITIAL_BPT_SUPPLY, but most of it remains in the Pool, waiting to be exchanged for tokens. The
  // actual amount of BPT in circulation is the total supply minus the amount held by the Pool, and is known as the
  // 'virtual supply'.
  static MAX_TOKEN_BALANCE = BigNumber.from('2').pow('112').sub('1');

  /*
    scaling factors should include rate:
    i.e.
    scalingFactors: pool.tokens.map(({ decimals, priceRate }) =>
        MathSol.mulDownFixed(getTokenScalingFactor(decimals), priceRate)
    )
    */
  onSell(
    amounts: bigint[],
    tokens: string[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    bptIndex: number,
    scalingFactors: bigint[],
    swapFeePercentage: bigint,
    amplificationParameter: bigint,
  ): bigint[] {
    return this._swapGivenIn(
      amounts,
      tokens,
      balances,
      indexIn,
      indexOut,
      bptIndex,
      scalingFactors,
      swapFeePercentage,
      amplificationParameter,
    );
  }

  // StablePool's `_onSwapGivenIn` and `_onSwapGivenOut` handlers are meant to process swaps between Pool tokens.
  // Since one of the Pool's tokens is the preminted BPT, we neeed to a) handle swaps where that tokens is involved
  // separately (as they are effectively single-token joins or exits), and b) remove BPT from the balances array when
  // processing regular swaps before delegating those to StablePool's handler.
  removeBPT(
    balances: bigint[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    bptIndex: number,
  ): {
    balances: bigint[];
    indexIn: number;
    indexOut: number;
  } {
    if (bptIndex != -1) {
      balances.splice(bptIndex, 1);
      if (bptIndex < tokenIndexIn) tokenIndexIn -= 1;
      if (bptIndex < tokenIndexOut) tokenIndexOut -= 1;
    }
    return {
      balances,
      indexIn: tokenIndexIn,
      indexOut: tokenIndexOut,
    };
  }

  _swapGivenIn(
    tokenAmountsIn: bigint[],
    tokens: string[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    bptIndex: number,
    scalingFactors: bigint[],
    swapFeePercentage: bigint,
    amplificationParameter: bigint,
  ): bigint[] {
    // Phantom pools allow trading between token and pool BPT
    let pairType: PairTypes;
    if (isSameAddress(tokens[indexIn], tokens[bptIndex])) {
      pairType = PairTypes.BptToToken;
    } else if (isSameAddress(tokens[indexOut], tokens[bptIndex])) {
      pairType = PairTypes.TokenToBpt;
    } else {
      pairType = PairTypes.TokenToToken;
    }

    // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
    const tokenAmountsInWithFee = tokenAmountsIn.map(a =>
      this._subtractSwapFeeAmount(a, swapFeePercentage),
    );
    const balancesUpscaled = this._upscaleArray(balances, scalingFactors);
    const tokenAmountsInScaled = tokenAmountsInWithFee.map(a =>
      this._upscale(a, scalingFactors[indexIn]),
    );

    // VirtualBPTSupply must be used for the maths
    const virtualBptSupply = PhantomStablePool.MAX_TOKEN_BALANCE.sub(
      balances[bptIndex],
    ).toBigInt();

    const droppedBpt = this.removeBPT(
      balancesUpscaled,
      indexIn,
      indexOut,
      bptIndex,
    );

    const amountsOut = this._onSwapGivenIn(
      tokenAmountsInScaled,
      droppedBpt.balances,
      droppedBpt.indexIn,
      droppedBpt.indexOut,
      amplificationParameter,
      virtualBptSupply,
      pairType,
    );

    // amountOut tokens are exiting the Pool, so we round down.
    return amountsOut.map(a =>
      this._downscaleDown(a, scalingFactors[indexOut]),
    );
  }

  /*
     Called when a swap with the Pool occurs, where the amount of tokens entering the Pool is known.
     All amounts are upscaled.
     Swap fee is already deducted.
     The return value is also considered upscaled, and should be downscaled (rounding down)
     */
  _onSwapGivenIn(
    tokenAmountsIn: bigint[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    _amplificationParameter: bigint,
    virtualBptSupply: bigint,
    pairType: PairTypes,
  ): bigint[] {
    const invariant = StableMath._calculateInvariant(
      _amplificationParameter,
      balances,
      true,
    );

    const amountsOut: bigint[] = [];

    if (pairType === PairTypes.TokenToBpt) {
      tokenAmountsIn.forEach(amountIn => {
        let amt: bigint;
        try {
          const amountsInBigInt = Array(balances.length).fill(BZERO);
          amountsInBigInt[indexIn] = amountIn;

          amt = StableMath._calcBptOutGivenExactTokensIn(
            _amplificationParameter,
            balances,
            amountsInBigInt,
            virtualBptSupply,
            invariant,
          );
        } catch (err) {
          amt = BZERO;
        }
        amountsOut.push(amt);
      });
    } else if (pairType === PairTypes.BptToToken) {
      tokenAmountsIn.forEach(amountIn => {
        let amt: bigint;
        try {
          amt = StableMath._calcTokenOutGivenExactBptIn(
            _amplificationParameter,
            balances,
            indexOut,
            amountIn,
            virtualBptSupply,
            invariant,
          );
        } catch (err) {
          amt = BZERO;
        }
        amountsOut.push(amt);
      });
    } else {
      tokenAmountsIn.forEach(amountIn => {
        let amt: bigint;
        try {
          amt = StableMath._calcOutGivenIn(
            _amplificationParameter,
            balances,
            indexIn,
            indexOut,
            amountIn,
            invariant,
          );
        } catch (err) {
          amt = BZERO;
        }
        amountsOut.push(amt);
      });
    }
    return amountsOut;
  }

  /*
    Helper function to parse pool data into params for onSell function.
    */
  parsePoolPairDataBigInt(
    pool: SubgraphPoolBase,
    poolState: PoolState,
    tokenIn: string,
    tokenOut: string,
  ): PhantomStablePoolPairData {
    const indexIn = pool.tokens.findIndex(
      t => t.address.toLowerCase() === tokenIn.toLowerCase(),
    );
    const indexOut = pool.tokens.findIndex(
      t => t.address.toLowerCase() === tokenOut.toLowerCase(),
    );
    const bptIndex = pool.tokens.findIndex(
      t => t.address.toLowerCase() === pool.address.toLowerCase(),
    );
    const tokenAddresses = pool.tokens.map(t => t.address);
    const balances = pool.tokens.map(
      t => poolState.tokens[t.address.toLowerCase()].balance,
    );
    const scalingFactors = pool.tokens.map(t =>
      getTokenScalingFactor(t.decimals),
    );
    const poolPairData: PhantomStablePoolPairData = {
      tokens: tokenAddresses,
      balances,
      indexIn: indexIn,
      indexOut: indexOut,
      scalingFactors,
      bptIndex,
      swapFee: poolState.swapFee,
      amp: poolState.amp ? poolState.amp : BigInt(0),
    };
    return poolPairData;
  }
}
