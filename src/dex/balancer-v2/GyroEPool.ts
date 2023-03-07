import { Interface } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';

import { BasePool } from './balancer-v2-pool';
import { SwapSide } from '../../constants';
import {
  decodeThrowError,
  getTokenScalingFactor,
  safeParseFixed,
} from './utils';
import { callData, SubgraphPoolBase, PoolState, TokenState } from './types';
import { MathSol } from './balancer-v2-math';
import {
  GyroEMaths,
  DerivedGyroEParams,
  GyroEParams,
  balancesFromTokenInOut,
  Vector2,
} from '@balancer-labs/sor';

// Swap Limit factor
const SWAP_LIMIT_FACTOR = BigInt('999999000000000000');

// All values should be normalised to 18 decimals. e.g. 1USDC = 1e18 not 1e6
export type GyroEPoolPairData = {
  balances: BigNumber[];
  indexIn: number;
  indexOut: number;
  swapFee: bigint;
  scalingFactors: bigint[];
  tokenInIsToken0: boolean;
  gyroEParams: GyroEParams;
  derivedGyroEParams: DerivedGyroEParams;
};

export class GyroEPool extends BasePool {
  vaultAddress: string;
  vaultInterface: Interface;
  poolInterface = new Interface([
    'function getSwapFeePercentage() view returns (uint256)',
  ]);

  constructor(vaultAddress: string, vaultInterface: Interface) {
    super();
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
  }

  parsePoolPairData(
    pool: SubgraphPoolBase,
    poolState: PoolState,
    tokenIn: string,
    tokenOut: string,
  ): GyroEPoolPairData {
    // All values should be normalised to 18 decimals. e.g. 1USDC = 1e18 not 1e6
    let indexIn = 0,
      indexOut = 0;
    const scalingFactors: bigint[] = [];
    const balances = pool.tokens.map((t, i) => {
      if (t.address.toLowerCase() === tokenIn.toLowerCase()) indexIn = i;
      else if (t.address.toLowerCase() === tokenOut.toLowerCase()) indexOut = i;
      const scalingFactor = getTokenScalingFactor(t.decimals);
      scalingFactors.push(scalingFactor);
      return BigNumber.from(
        this._upscale(
          BigInt(poolState.tokens[t.address.toLowerCase()].balance),
          scalingFactor,
        ),
      );
    });

    const gyroEParams = {
      alpha: safeParseFixed(pool.alpha, 18),
      beta: safeParseFixed(pool.beta, 18),
      c: safeParseFixed(pool.c, 18),
      s: safeParseFixed(pool.s, 18),
      lambda: safeParseFixed(pool.lambda, 18),
    };

    const derivedGyroEParamsFromSubgraph = {
      tauAlpha: {
        x: safeParseFixed(pool.tauAlphaX, 38),
        y: safeParseFixed(pool.tauAlphaY, 38),
      },
      tauBeta: {
        x: safeParseFixed(pool.tauBetaX, 38),
        y: safeParseFixed(pool.tauBetaY, 38),
      },
      u: safeParseFixed(pool.u, 38),
      v: safeParseFixed(pool.v, 38),
      w: safeParseFixed(pool.w, 38),
      z: safeParseFixed(pool.z, 38),
      dSq: safeParseFixed(pool.dSq, 38),
    };

    const tokenInIsToken0 = indexIn === 0;

    const poolPairData: GyroEPoolPairData = {
      balances,
      indexIn,
      indexOut,
      scalingFactors,
      swapFee: poolState.swapFee,
      derivedGyroEParams: derivedGyroEParamsFromSubgraph,
      gyroEParams: gyroEParams,
      tokenInIsToken0,
    };
    return poolPairData;
  }

  getSwapMaxAmount(poolPairData: GyroEPoolPairData, side: SwapSide): bigint {
    if (side === SwapSide.SELL) {
      // Approximation - similar to traditional stable pools
      return this._downscaleDown(
        MathSol.mulDownFixed(
          poolPairData.balances[poolPairData.indexOut].toBigInt(),
          SWAP_LIMIT_FACTOR,
        ),
        poolPairData.scalingFactors[poolPairData.indexIn],
      );
    } else {
      // Not currently supported
      return BigInt(0);
    }
  }

  /*
  Helper function to construct onchain multicall data for Pool.
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
    ];
    return poolCallData;
  }

  /*
  Helper function to decode multicall data for Pool.
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

    const poolState: PoolState = {
      swapFee: BigInt(swapFee.toString()),
      orderedTokens: poolTokens.tokens,
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
    pools[pool.address] = poolState;
    return [pools, startIndex];
  }

  onSell(amounts: bigint[], poolPairData: GyroEPoolPairData): bigint[] {
    try {
      const orderedNormalizedBalances = balancesFromTokenInOut(
        poolPairData.balances[poolPairData.indexIn],
        poolPairData.balances[poolPairData.indexOut],
        poolPairData.tokenInIsToken0,
      );
      const [currentInvariant, invErr] = GyroEMaths.calculateInvariantWithError(
        orderedNormalizedBalances,
        poolPairData.gyroEParams,
        poolPairData.derivedGyroEParams,
      );

      const invariant: Vector2 = {
        x: currentInvariant.add(invErr.mul(2)),
        y: currentInvariant,
      };

      const tokenAmountsInScaled = amounts.map(a =>
        this._upscale(a, poolPairData.scalingFactors[poolPairData.indexIn]),
      );

      const tokenAmountsInWithFee = tokenAmountsInScaled.map(a =>
        this._subtractSwapFeeAmount(a, poolPairData.swapFee),
      );

      const amountsOut: bigint[] = tokenAmountsInWithFee.map(amount => {
        try {
          const amountOut = GyroEMaths.calcOutGivenIn(
            orderedNormalizedBalances,
            BigNumber.from(amount),
            poolPairData.tokenInIsToken0,
            poolPairData.gyroEParams,
            poolPairData.derivedGyroEParams,
            invariant,
          ).toBigInt();
          return this._downscaleDown(
            amountOut,
            poolPairData.scalingFactors[poolPairData.indexOut],
          );
        } catch (error) {
          return BigInt(0);
        }
      });

      return amountsOut;
    } catch (error) {
      return [];
    }
  }
}
