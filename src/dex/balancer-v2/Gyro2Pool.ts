import { Interface } from '@ethersproject/abi';

import { BasePool } from './balancer-v2-pool';
import { SwapSide } from '../../constants';
import {
  decodeThrowError,
  getTokenScalingFactor,
  safeParseFixed,
} from './utils';
import { callData, SubgraphPoolBase, PoolState, TokenState } from './types';

// All values should be normalised to 18 decimals. e.g. 1USDC = 1e18 not 1e6
type Gyro2PoolPairData = {
  balances: bigint[];
  indexIn: number;
  indexOut: number;
  swapFee: bigint;
  sqrtAlpha: bigint;
  sqrtBeta: bigint;
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
      return this._upscale(
        BigInt(poolState.tokens[t.address.toLowerCase()].balance),
        scalingFactor,
      );
    });

    const poolPairData: Gyro2PoolPairData = {
      balances,
      indexIn,
      indexOut,
      scalingFactors,
      swapFee: poolState.swapFee,
      sqrtAlpha: safeParseFixed(pool.sqrtAlpha, 18).toBigInt(),
      sqrtBeta: safeParseFixed(pool.sqrtBeta, 18).toBigInt(),
    };
    return poolPairData;
  }

  getSwapMaxAmount(poolPairData: Gyro2PoolPairData, side: SwapSide): bigint {
    return BigInt(0);
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
    return [];
  }
}
