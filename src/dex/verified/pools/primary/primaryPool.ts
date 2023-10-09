import { Interface } from '@ethersproject/abi';
import {
  PoolPairData,
  PoolState,
  SubgraphPoolBase,
  TokenState,
  callData,
} from '../../types';
import { MathSol } from '../generalPoolMath';
import PRIMARYISSUEPOOL from '../../../../abi/verified/PrimaryIssuePool.json';
import { decodeThrowError } from '../../utils';
import { SwapSide } from '@paraswap/core';

//Todo: explain the math better(after testing secondary)

export class PrimaryIssuePool {
  vaultAddress: string;
  vaultInterface: Interface;
  poolInterface: Interface;

  constructor(vaultAddress: string, vaultInterface: Interface) {
    this.vaultAddress = vaultAddress;
    this.vaultInterface = vaultInterface;
    this.poolInterface = new Interface(PRIMARYISSUEPOOL.abi);
  }

  //Helper function to parse both primary and secondary issue pools data into params for onSell and onBuy functions.
  parsePoolPairData(
    pool: SubgraphPoolBase,
    poolState: PoolState,
    tokenIn: string,
    tokenOut: string,
  ): PoolPairData {
    let indexIn = 0;
    let indexOut = 0;
    let bptIndex = 0;
    let balances: bigint[] = [];
    let decimals: number[] = [];
    let scalingFactors: bigint[] = [];
    const tokens = poolState.orderedTokens.map((tokenAddress, i) => {
      const t = pool.tokensMap[tokenAddress.toLowerCase()];
      if (t.address.toLowerCase() === tokenIn.toLowerCase()) indexIn = i;
      if (t.address.toLowerCase() === tokenOut.toLowerCase()) indexOut = i;
      if (t.address.toLowerCase() === pool.address.toLowerCase()) bptIndex = i;
      balances.push(poolState.tokens[t.address.toLowerCase()].balance);
      const _decimal = pool.tokens[i].decimals;
      decimals.push(_decimal);
      scalingFactors.push(BigInt(10 ** (18 - _decimal)));
      return t.address;
    });
    const poolPairData: PoolPairData = {
      tokens,
      balances,
      decimals,
      indexIn,
      indexOut,
      bptIndex,
      swapFee: poolState.swapFee,
      minOrderSize: poolState.minimumOrderSize,
      minPrice: poolState.minimumPrice,
      scalingFactors,
    };
    return poolPairData;
  }

  //constructs onchain multicall data for Primary Issue Pool.
  //To get primary pool tokens from vault contract, minimum orderSize minimumprice from primary contract
  getOnChainCalls(pool: SubgraphPoolBase, vaultAddress: string): callData[] {
    const poolCallData: callData[] = [
      {
        target: vaultAddress,
        callData: this.vaultInterface.encodeFunctionData('getPoolTokens', [
          pool.id,
        ]),
      },
    ];
    poolCallData.push({
      target: pool.address,
      callData: this.poolInterface.encodeFunctionData('getMinimumPrice'),
    });
    poolCallData.push({
      target: pool.address,
      callData: this.poolInterface.encodeFunctionData('getMinimumOrderSize'),
    });

    return poolCallData;
  }

  //Decodes multicall data for Primary Issue pools. And save pools using address to poolState Mapping.
  //Data must contain returnData. StartIndex is where to start in returnData.
  decodeOnChainCalls(
    pool: SubgraphPoolBase,
    data: { success: boolean; returnData: any }[],
    startIndex: number,
  ): [{ [address: string]: PoolState }, number] {
    const pools = {} as { [address: string]: PoolState };
    let minimumOrderSize: any;
    let minimumPrice: any;

    const poolTokens = decodeThrowError(
      this.vaultInterface,
      'getPoolTokens',
      data[startIndex++],
      pool.address,
    );

    minimumOrderSize = decodeThrowError(
      this.poolInterface,
      'getMinimumOrderSize',
      data[startIndex++],
      pool.address,
    )[0];

    minimumPrice = decodeThrowError(
      this.poolInterface,
      'getMinimumPrice',
      data[startIndex++],
      pool.address,
    )[0];

    const poolState: PoolState = {
      swapFee: BigInt('0'),
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
      orderedTokens: poolTokens.tokens,
      minimumOrderSize,
      minimumPrice,
    };

    pools[pool.address] = poolState;

    return [pools, startIndex];
  }

  //gets amount of tokenOut in primaryIssue pool(used when selling) according to calculation from SOR Repo
  getPrimaryTokenOut(
    poolPairData: PoolPairData,
    amount: bigint,
    isCurrencyIn: boolean,
  ): bigint {
    try {
      if (amount === 0n) return 0n;
      //up scale balance according to upscaleArray function on basepool contract
      //don't divide by 1e18 to avoid 0 result incase balance is too small
      const scaledBalances = poolPairData.balances.map((balance, idx) => {
        return MathSol.mul(balance, poolPairData.scalingFactors[idx]);
      });
      const tokenInBalance = scaledBalances[poolPairData.indexIn];
      const tokenOutBalance = scaledBalances[poolPairData.indexOut];
      //upscale amount using scaling factor of tokenin since(token out amount is what we are looking for)
      //according to upscale function on basepool contract
      //don't divide by 1e18 to avoid 0 result incase amount is too small
      const scaledAmount = MathSol.mul(
        amount,
        poolPairData.scalingFactors[poolPairData.indexIn],
      );
      let amountOut: bigint;
      if (isCurrencyIn) {
        const preCalc = MathSol.add(tokenInBalance, scaledAmount);
        const postCalc = MathSol.divDownFixed(
          scaledAmount,
          BigInt(poolPairData.minPrice!),
        );
        amountOut = MathSol.divDown(
          postCalc,
          MathSol.divDown(preCalc, tokenInBalance),
        );
        if (amountOut < BigInt(poolPairData.minOrderSize)) {
          return 0n;
        }
        if (
          MathSol.divDownFixed(scaledAmount, amountOut) <
          BigInt(poolPairData.minPrice!)
        ) {
          return 0n;
        }
      } else {
        if (tokenInBalance <= 0n) {
          return 0n;
        }
        if (scaledAmount < BigInt(poolPairData.minOrderSize)) {
          return 0n;
        }
        const preCalc = MathSol.add(scaledAmount, tokenInBalance);
        const postCalc = MathSol.divDownFixed(preCalc, tokenInBalance);
        amountOut = MathSol.mulDownFixed(
          postCalc,
          MathSol.mulDownFixed(scaledAmount, BigInt(poolPairData.minPrice!)),
        );
        if (
          MathSol.divDownFixed(amountOut, scaledAmount) <
          BigInt(poolPairData.minPrice!)
        ) {
          return 0n;
        }
      }
      if (tokenOutBalance < amountOut) {
        return 0n;
      }
      //downscaledown amountout by tokenout scaling factor as done on primaryissuepool contract
      //don't use fixed method to get rid of 1e18 added from scaling of balances and amount
      return MathSol.divDown(
        amountOut,
        poolPairData.scalingFactors[poolPairData.indexOut],
      );
    } catch (err: any) {
      return 0n;
    }
  }

  //gets amount of tokenIn in primaryIssue pool(used when buying) according to calculation from SOR Repo
  getPrimaryTokenIn(
    poolPairData: PoolPairData,
    amount: bigint,
    isCurrencyIn: boolean,
  ): bigint {
    try {
      if (amount === 0n) {
        return 0n;
      }
      //up scale balance according to upscaleArray function on basepool contract
      //don't divide by 1e18 to avoid 0 result incase balance is too small
      const scaledBalances = poolPairData.balances.map((balance, idx) => {
        return MathSol.mul(balance, poolPairData.scalingFactors[idx]);
      });
      const tokenInBalance = scaledBalances[poolPairData.indexIn];
      const tokenOutBalance = scaledBalances[poolPairData.indexOut];
      //up scale amount using scaling factor of tokenout(since amount of tokenin is what we are looking for)
      //according to upscale function on basepool contract
      //don't divide by 1e18 to avoid 0 result incase balance is too small
      const scaledAmount = MathSol.mul(
        amount,
        poolPairData.scalingFactors[poolPairData.indexOut],
      );
      let amountIn: bigint;
      if (isCurrencyIn) {
        if (scaledAmount >= tokenOutBalance) {
          return 0n;
        }
        if (scaledAmount < BigInt(poolPairData.minOrderSize!)) {
          return 0n;
        }
        const preCalc = MathSol.sub(tokenOutBalance, scaledAmount);
        const postCalc = MathSol.divDownFixed(tokenOutBalance, preCalc);
        amountIn = MathSol.mulDownFixed(
          postCalc,
          MathSol.mulDownFixed(scaledAmount, BigInt(poolPairData.minPrice!)),
        );
        if (
          MathSol.divDownFixed(amountIn, scaledAmount) <
          BigInt(poolPairData.minPrice!)
        ) {
          return 0n;
        }
      } else {
        if (tokenInBalance <= 0n) {
          return 0n;
        }
        if (scaledAmount >= tokenOutBalance) {
          return 0n;
        }
        const preCalc = MathSol.sub(tokenOutBalance, scaledAmount);
        const postCalc = MathSol.divDownFixed(
          scaledAmount,
          BigInt(poolPairData.minPrice!),
        );
        amountIn = MathSol.divDownFixed(
          postCalc,
          MathSol.divDownFixed(tokenOutBalance, preCalc),
        );
        if (amountIn < BigInt(poolPairData.minOrderSize)) {
          return 0n;
        }
        if (
          MathSol.divDownFixed(scaledAmount, amountIn) <
          BigInt(poolPairData.minPrice!)
        ) {
          return 0n;
        }
      }
      //downscaleup amountIn by token in scaling factor has done on primary issue pool
      //don't use fixed method to get rid of 1e18 added from scaling of balances and amount
      return MathSol.divUp(
        amountIn,
        poolPairData.scalingFactors[poolPairData.indexIn],
      );
    } catch (err: any) {
      return 0n;
    }
  }
  // Helper function that get tokenIn when buying in primary issue pools
  onBuy(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
  ): bigint[] {
    return amounts.map(amount =>
      this.getPrimaryTokenIn(poolPairData, amount, isCurrencyIn),
    );
  }

  //Helper function that get tokenOut when selling in both primary issue pool
  onSell(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
  ): bigint[] {
    return amounts.map(amount =>
      this.getPrimaryTokenOut(poolPairData, amount, isCurrencyIn),
    );
  }

  //TODO: Verify if token decimals are not nedded to get actual balance(depending on the format of amount in)
  //gets maxAmount that can be swapped in or out of both primary issue pool
  //use 99% of the balance so not all balance can be swapped.
  getSwapMaxAmount(poolPairData: PoolPairData, side: SwapSide): bigint {
    return (
      ((side === SwapSide.SELL
        ? poolPairData.balances[poolPairData.indexIn]
        : poolPairData.balances[poolPairData.indexOut]) *
        99n) /
      100n
    );
  }
}
