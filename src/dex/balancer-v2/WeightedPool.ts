import { Interface } from '@ethersproject/abi';

import { BasePool } from './BasePool';
import { WeightedMath } from './WeightedMath';
import { getTokenScalingFactor, decodeThrowError } from './utils';
import { callData, SubgraphPoolBase, PoolState, TokenState } from './types';
import { SwapSide } from '../../constants';
import WeightedPoolABI from '../../abi/balancer-v2/weighted-pool.json';

type WeightedPoolPairData = {
  tokenInBalance: bigint;
  tokenOutBalance: bigint;
  tokenInScalingFactor: bigint;
  tokenOutScalingFactor: bigint;
  tokenInWeight: bigint;
  tokenOutWeight: bigint;
  swapFee: bigint;
};

export class WeightedPool extends BasePool {
  vaultAddress: string;
  vaultInterface: Interface;
  poolInterface: Interface;

  constructor(vaultAddress: string, vaultInterface: Interface) {
    super();
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
    this.poolInterface = new Interface(WeightedPoolABI);
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
    };

    pools[pool.address] = poolState;

    return [pools, startIndex];
  }

  /*
    For weighted pools there is a Swap limit of 30%: amounts swapped may not be larger than this percentage of total balance.
    */
  checkBalance(
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
    poolPairData: WeightedPoolPairData,
  ): boolean {
    const swapMax =
      ((side === SwapSide.SELL
        ? poolPairData.tokenInBalance
        : poolPairData.tokenOutBalance) *
        BigInt(3)) /
      BigInt(10);
    const swapAmount =
      amounts[amounts.length - 1] > unitVolume
        ? amounts[amounts.length - 1]
        : unitVolume;
    return swapMax > swapAmount;
  }
}
