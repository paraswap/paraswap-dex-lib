import { Interface } from '@ethersproject/abi';
import {
  OrdersState,
  PoolPairData,
  PoolState,
  SubgraphPoolBase,
  TokenState,
  VerifiedPoolTypes,
  callData,
} from '../../types';
import { MathSol } from '../primary/primaryPoolMath';
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
    const orders = pool.orders;
    const secondaryTrades = pool.secondaryTrades;
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
      orders,
      secondaryTrades,
    };
    return poolPairData;
  }

  //constructs onchain multicall data for Both Primary and SecondaryIssue Pool.
  //To get pool(primary/secondary) tokens from vault contract, minimum orderSize from primary and secondary,
  //minimumprice from primary
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

  //Decodes multicall data for both Primary and SecondaryIssue pools. And save pools using address to poolState Mapping.
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
      const scaledBalances = poolPairData.balances.map((balance, idx) => {
        return MathSol.mul(balance, poolPairData.scalingFactors[idx]);
      });
      const tokenInBalance = scaledBalances[poolPairData.indexIn];
      const tokenOutBalance = scaledBalances[poolPairData.indexOut];
      const scaledAmount = MathSol.mul(
        amount,
        poolPairData.scalingFactors[poolPairData.indexIn],
      );
      let amountIn: bigint;
      if (isCurrencyIn) {
        if (tokenOutBalance <= 0n) {
          return 0n;
        }
        if (scaledAmount >= tokenInBalance) {
          return 0n;
        }
        const preCalc = MathSol.sub(tokenInBalance, scaledAmount);
        const postCalc = MathSol.divDownFixed(
          scaledAmount,
          BigInt(poolPairData.minPrice!),
        );
        amountIn = MathSol.divDownFixed(
          postCalc,
          MathSol.divDownFixed(tokenInBalance, preCalc),
        );
        if (amountIn < poolPairData.minOrderSize!) {
          return 0n;
        }
        if (
          MathSol.divDownFixed(scaledAmount, amountIn) <
          BigInt(poolPairData.minPrice!)
        ) {
          return 0n;
        }
      } else {
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
      }
      return amountIn;
    } catch (err: any) {
      return 0n;
    }
  }

  //gets amount of tokenOut in primaryIssue pool(used when selling) according to calculation from SOR Repo
  getPrimaryTokenOut(
    poolPairData: PoolPairData,
    amount: bigint,
    isCurrencyIn: boolean,
  ): bigint {
    try {
      if (amount === 0n) return 0n;
      const scaledBalances = poolPairData.balances.map((balance, idx) => {
        return MathSol.mul(balance, poolPairData.scalingFactors[idx]);
      });
      const tokenInBalance = scaledBalances[poolPairData.indexIn];
      const tokenOutBalance = scaledBalances[poolPairData.indexOut];
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
      return amountOut;
    } catch (err: any) {
      return 0n;
    }
  }

  // Helper function that get tokenIn when buying in both primary and secondaery issue pools
  onBuy(
    amounts: bigint[],
    poolPairData: PoolPairData,
    isCurrencyIn: boolean,
  ): bigint[] {
    return amounts.map(amount =>
      this.getPrimaryTokenIn(poolPairData, amount, isCurrencyIn),
    );
  }

  //Helper function that get tokenOut when selling in both primary and secondaery issue pools
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
  //gets maxAmount that can be swapped in or out of both primary and secondary issue pools
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
