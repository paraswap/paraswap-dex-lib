import { Interface } from '@ethersproject/abi';
import { BasePool } from './BasePool';
import { SwapSide } from '../../constants';
import { callData, SubgraphPoolBase, PoolState, TokenState } from './types';
import { getTokenScalingFactor, decodeThrowError } from './utils';
import { BZERO } from './balancer-v2-math';
import * as StableMath from './StableMath';

import StablePoolABI from '../../abi/balancer-v2/stable-pool.json';

type StablePoolPairData = {
  balances: bigint[];
  indexIn: number;
  indexOut: number;
  scalingFactors: bigint[];
  swapFee: bigint;
  amp: bigint;
};

export class StablePool extends BasePool {
  vaultAddress: string;
  vaultInterface: Interface;
  poolInterface: Interface;

  constructor(vaultAddress: string, vaultInterface: Interface) {
    super();
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
    this.poolInterface = new Interface(StablePoolABI);
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

  _onSwapGivenIn(
    tokenAmountsIn: bigint[],
    balances: bigint[],
    indexIn: number,
    indexOut: number,
    _amplificationParameter: bigint,
  ): bigint[] {
    const invariant = StableMath._calculateInvariant(
      _amplificationParameter,
      balances,
      true,
    );

    const amountsOut: bigint[] = [];

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

    return amountsOut;
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
    const balances = pool.tokens.map((t, i) => {
      if (t.address.toLowerCase() === tokenIn.toLowerCase()) indexIn = i;
      if (t.address.toLowerCase() === tokenOut.toLowerCase()) indexOut = i;
      if (pool.poolType === 'MetaStable')
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
        callData: this.poolInterface.encodeFunctionData(
          'getAmplificationParameter',
        ),
      },
    ];
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
    amounts: bigint[],
    unitVolume: bigint,
    side: SwapSide,
    poolPairData: StablePoolPairData,
  ): boolean {
    const swapMax =
      (this._upscale(
        poolPairData.balances[poolPairData.indexOut],
        poolPairData.scalingFactors[poolPairData.indexOut],
      ) *
        BigInt(99)) /
      BigInt(100);
    const swapAmount =
      amounts[amounts.length - 1] > unitVolume
        ? amounts[amounts.length - 1]
        : unitVolume;
    return swapMax > swapAmount;
  }
}
