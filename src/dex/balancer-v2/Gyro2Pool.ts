import { Interface } from '@ethersproject/abi';

import { BasePool } from './balancer-v2-pool';
import { SwapSide } from '../../constants';
import { decodeThrowError } from './utils';
import { callData, SubgraphPoolBase, PoolState, TokenState } from './types';

type Gyro2PoolPairData = {
  balances: bigint[];
  indexIn: number;
  indexOut: number;
  scalingFactors: bigint[];
  swapFee: bigint;
  amp: bigint;
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
    return {} as Gyro2PoolPairData;
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
