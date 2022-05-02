import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';
import { BasePool } from './balancer-v2-pool';
import { isSameAddress, decodeThrowError } from './utils';
import * as StableMath from './StableMath';
import {
  SubgraphPoolBase,
  PoolState,
  callData,
  TokenState,
  PoolBase,
} from './types';
import { SwapSide } from '../../constants';
import MetaStablePoolABI from '../../abi/balancer-v2/meta-stable-pool.json';

enum PairTypes {
  BptToToken,
  TokenToBpt,
  TokenToToken,
}

type PhantomStablePoolPairData = {
  tokens: string[];
  balances: bigint[];
  indexIn: number;
  indexOut: number;
  scalingFactors: bigint[];
  bptIndex: number;
  swapFee: bigint;
  amp: bigint;
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
export class PhantomStablePool extends BasePool implements PoolBase {
  // This is the maximum token amount the Vault can hold. In regular operation, the total BPT supply remains constant
  // and equal to _INITIAL_BPT_SUPPLY, but most of it remains in the Pool, waiting to be exchanged for tokens. The
  // actual amount of BPT in circulation is the total supply minus the amount held by the Pool, and is known as the
  // 'virtual supply'.
  MAX_TOKEN_BALANCE = BigNumber.from('2').pow('112').sub('1');
  vaultAddress: string;
  vaultInterface: Interface;
  poolInterface: Interface;
  gasCost = 130000;

  constructor(vaultAddress: string, vaultInterface: Interface) {
    super();
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
    this.poolInterface = new Interface(MetaStablePoolABI);
  }

  /*
    scaling factors should include rate:
    i.e.
    scalingFactors: pool.tokens.map(({ decimals, priceRate }) =>
        MathSol.mulDownFixed(getTokenScalingFactor(decimals), priceRate)
    )
    */
  onSell(amounts: bigint[], poolPairData: PhantomStablePoolPairData): bigint[] {
    return this._swapGivenIn(
      amounts,
      poolPairData.tokens,
      poolPairData.balances,
      poolPairData.indexIn,
      poolPairData.indexOut,
      poolPairData.bptIndex,
      poolPairData.scalingFactors,
      poolPairData.swapFee,
      poolPairData.amp,
    );
  }

  // StablePool's `_onSwapGivenIn` and `_onSwapGivenOut` handlers are meant to process swaps between Pool tokens.
  // Since one of the Pool's tokens is the preminted BPT, we need to a) handle swaps where that tokens is involved
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
    const virtualBptSupply = this.MAX_TOKEN_BALANCE.sub(
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
          const amountsInBigInt = Array(balances.length).fill(0n);
          amountsInBigInt[indexIn] = amountIn;

          amt = StableMath._calcBptOutGivenExactTokensIn(
            _amplificationParameter,
            balances,
            amountsInBigInt,
            virtualBptSupply,
            invariant,
          );
        } catch (err) {
          amt = 0n;
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
          amt = 0n;
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
          amt = 0n;
        }
        amountsOut.push(amt);
      });
    }
    return amountsOut;
  }

  /*
    Helper function to parse pool data into params for onSell function.
    */
  parsePoolPairData(
    pool: SubgraphPoolBase,
    poolStates: { [address: string]: PoolState },
    tokenIn: string,
    tokenOut: string,
  ): PhantomStablePoolPairData {
    const poolState = poolStates[pool.address];
    let indexIn = 0,
      indexOut = 0,
      bptIndex = 0;
    const balances: bigint[] = [];
    const scalingFactors: bigint[] = [];

    const tokens = pool.tokens.map((t, i) => {
      if (t.address.toLowerCase() === tokenIn.toLowerCase()) indexIn = i;
      if (t.address.toLowerCase() === tokenOut.toLowerCase()) indexOut = i;
      if (t.address.toLowerCase() === pool.address.toLowerCase()) bptIndex = i;

      balances.push(poolState.tokens[t.address.toLowerCase()].balance);
      scalingFactors.push(
        poolState.tokens[t.address.toLowerCase()].scalingFactor || 0n,
      );
      return t.address;
    });

    const poolPairData: PhantomStablePoolPairData = {
      tokens,
      balances,
      indexIn,
      indexOut,
      scalingFactors,
      bptIndex,
      swapFee: poolState.swapFee,
      amp: poolState.amp ? poolState.amp : 0n,
    };
    return poolPairData;
  }

  /*
  Helper function to construct onchain multicall data for PhantomStablePool.
  Main difference to standard StablePool is scaling factors which includes rate.
  This also applies to MetaStablePool.
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
        callData: this.poolInterface.encodeFunctionData('getScalingFactors'),
      },
      {
        target: pool.address,
        callData: this.poolInterface.encodeFunctionData(
          'getAmplificationParameter',
        ),
      },
    ];
  }

  /*
  Helper function to decodes multicall data for a PhantomStable Pool.
  Main difference to standard StablePool is scaling factors which includes rate.
  This also applies to MetaStablePool.
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
    const scalingFactors = decodeThrowError(
      this.poolInterface,
      'getScalingFactors',
      data[startIndex++],
      pool.address,
    )[0];
    const amp = decodeThrowError(
      this.poolInterface,
      'getAmplificationParameter',
      data[startIndex++],
      pool.address,
    );

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
      gasCost: this.gasCost,
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
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
    poolPairData: PhantomStablePoolPairData,
  ): boolean {
    const swapMax =
      (this._upscale(
        poolPairData.balances[poolPairData.indexOut],
        poolPairData.scalingFactors[poolPairData.indexOut],
      ) *
        99n) /
      100n;
    const swapAmount =
      amounts[amounts.length - 1] > unitVolume
        ? amounts[amounts.length - 1]
        : unitVolume;
    return swapMax > swapAmount;
  }
}
