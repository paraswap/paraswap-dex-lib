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
import { Gyro2Maths } from '@balancer-labs/sor';

// Swap Limit factor
const SWAP_LIMIT_FACTOR = BigInt('999999000000000000');

// All values should be normalised to 18 decimals. e.g. 1USDC = 1e18 not 1e6
export type Gyro2PoolPairData = {
  balances: BigNumber[];
  indexIn: number;
  indexOut: number;
  swapFee: bigint;
  sqrtAlpha: BigNumber;
  sqrtBeta: BigNumber;
  scalingFactors: bigint[];
};

export class Gyro2Pool extends BasePool {
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
  ): Gyro2PoolPairData {
    // All values should be normalised to 18 decimals. e.g. 1USDC = 1e18 not 1e6
    let indexIn = 0,
      indexOut = 0;
    const scalingFactors: bigint[] = [];
    const balances = pool.tokens.map((t, i) => {
      if (t.address.toLowerCase() === tokenIn.toLowerCase()) indexIn = i;
      if (t.address.toLowerCase() === tokenOut.toLowerCase()) indexOut = i;
      const scalingFactor = getTokenScalingFactor(t.decimals);
      scalingFactors.push(scalingFactor);
      return BigNumber.from(
        this._upscale(
          BigInt(poolState.tokens[t.address.toLowerCase()].balance),
          scalingFactor,
        ),
      );
    });

    const poolPairData: Gyro2PoolPairData = {
      balances,
      indexIn,
      indexOut,
      scalingFactors,
      swapFee: poolState.swapFee,
      sqrtAlpha: safeParseFixed(pool.sqrtAlpha, 18),
      sqrtBeta: safeParseFixed(pool.sqrtBeta, 18),
    };
    return poolPairData;
  }

  getSwapMaxAmount(poolPairData: Gyro2PoolPairData, side: SwapSide): bigint {
    if (side === SwapSide.SELL) {
      // Same as ExactIn
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

  onSell(amounts: bigint[], poolPairData: Gyro2PoolPairData): bigint[] {
    try {
      const invariant = Gyro2Maths._calculateInvariant(
        poolPairData.balances,
        poolPairData.sqrtAlpha,
        poolPairData.sqrtBeta,
      );
      const [virtualParamIn, virtualParamOut] = Gyro2Maths._findVirtualParams(
        invariant,
        poolPairData.sqrtAlpha,
        poolPairData.sqrtBeta,
      );

      const tokenAmountsInScaled = amounts.map(a =>
        this._upscale(a, poolPairData.scalingFactors[poolPairData.indexIn]),
      );

      // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
      const tokenAmountsInWithFee = tokenAmountsInScaled.map(a =>
        this._subtractSwapFeeAmount(a, poolPairData.swapFee),
      );

      const amountsOut: bigint[] = tokenAmountsInWithFee.map(amount => {
        try {
          const amountOut = Gyro2Maths._calcOutGivenIn(
            poolPairData.balances[poolPairData.indexIn],
            poolPairData.balances[poolPairData.indexOut],
            BigNumber.from(amount),
            virtualParamIn,
            virtualParamOut,
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
