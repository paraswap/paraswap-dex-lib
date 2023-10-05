import { BasePool } from '../../../balancer-v2/pools/balancer-v2-pool';
import { Interface } from '@ethersproject/abi';
import PRIMARYISSUEPOOL from '../../../../abi/verified/PrimaryIssuePool.json';
import { PoolPairData } from '../../types';
import { MathSol } from '../../../balancer-v2/balancer-v2-math';
import { BigNumber, formatFixed } from '@ethersproject/bignumber';

//gets amount of tokenOut in primaryIssue pool(used when selling) according to calculation from SOR Repo
export function getPrimaryTokenOut(
  poolPairData: PoolPairData,
  amount: bigint,
  isCurrencyIn: boolean,
): bigint {
  try {
    if (amount === 0n) return 0n;
    const tokenInBalance = poolPairData.balances[poolPairData.indexIn];
    const tokenOutBalance = poolPairData.balances[poolPairData.indexOut];
    let tokenOut: bigint;
    if (isCurrencyIn) {
      //Swap Currency IN
      const scalingFactor = poolPairData.scalingFactors[poolPairData.indexIn];
      const currencyAmount = MathSol.mul(amount, scalingFactor);
      const numerator = MathSol.divDownFixed(
        currencyAmount,
        poolPairData.minPrice!,
      );
      const denominator = MathSol.divDownFixed(
        MathSol.add(tokenInBalance, currencyAmount),
        tokenInBalance,
      );
      tokenOut = MathSol.divDownFixed(numerator, denominator);
      if (tokenOut < poolPairData.minOrderSize) {
        return 0n;
      }
    } else {
      const scalingFactor = poolPairData.scalingFactors[poolPairData.indexOut];
      //Swap Security IN
      if (tokenInBalance < 0) return 0n;
      if (amount < poolPairData.minOrderSize) return 0n;
      const numerator = MathSol.divDownFixed(
        MathSol.add(tokenInBalance, amount),
        tokenInBalance,
      );
      const denominator = MathSol.mulDownFixed(amount, poolPairData.minPrice!);
      const _tokenOut = MathSol.mulDownFixed(numerator, denominator);

      tokenOut = MathSol.divDown(_tokenOut, scalingFactor);
    }
    const scaleTokenOut = formatFixed(
      BigNumber.from(Math.trunc(Number(tokenOut.toString())).toString()),
      poolPairData.decimals[poolPairData.indexOut],
    );
    if (tokenOutBalance < tokenOut) return 0n;
    return BigInt(scaleTokenOut);
  } catch (err: any) {
    return 0n;
  }
}

//gets amount of tokenIn in primaryIssue pool(used when buying) according to calculation from SOR Repo
export function getPrimaryTokenIn(
  poolPairData: PoolPairData,
  amount: bigint,
  isCurrencyIn: boolean,
): bigint {
  try {
    if (amount == 0n) return 0n;

    const tokenInBalance = poolPairData.balances[poolPairData.indexIn];
    const tokenOutBalance = poolPairData.balances[poolPairData.indexOut];
    let tokenIn: bigint;
    if (!isCurrencyIn) {
      //Swap Currency OUT
      const scalingFactor = poolPairData.scalingFactors[poolPairData.indexOut];
      if (tokenInBalance < 0) return 0n;
      const currencyAmount = MathSol.mul(amount, scalingFactor);
      if (currencyAmount >= tokenOutBalance) return 0n;

      const numerator = MathSol.divDownFixed(amount, poolPairData.minPrice!);
      const denominator = MathSol.divDownFixed(
        tokenOutBalance,
        MathSol.sub(tokenOutBalance, currencyAmount),
      );
      tokenIn = MathSol.divDownFixed(numerator, denominator);

      if (tokenIn < poolPairData.minOrderSize) return 0n;
    } else {
      //Swap Security OUT
      const scalingFactor = poolPairData.scalingFactors[poolPairData.indexIn];
      if (amount >= tokenOutBalance) return 0n;
      if (amount < poolPairData.minOrderSize) return 0n;
      const numerator = MathSol.divDownFixed(
        tokenOutBalance,
        MathSol.sub(tokenOutBalance, amount),
      );
      const denominator = MathSol.mulDownFixed(
        amount,
        BigInt(Number(poolPairData.minPrice!)),
      );

      tokenIn = MathSol.mulDownFixed(numerator, denominator);
      tokenIn = MathSol.divDown(tokenIn, scalingFactor);
    }

    const scaleTokenIn = formatFixed(
      BigNumber.from(Math.trunc(Number(tokenIn.toString())).toString()),
      poolPairData.decimals[poolPairData.indexIn],
    );

    return BigInt(scaleTokenIn);
  } catch (err: any) {
    return 0n;
  }
}
