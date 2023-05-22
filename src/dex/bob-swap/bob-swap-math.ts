import { PoolState } from './types';
import { Address, Logger } from '../../types';
import { DENOMINATOR, MAX_FEE, NULL_STATE } from './constants';
import * as querystring from 'querystring';

function handleMathError(e: unknown, logger: Logger) {
  logger.error('Unexpected error in BobVault math:', e);
}

export class BobSwapMath {
  state: PoolState = NULL_STATE;
  constructor(
    private readonly logger: Logger,
    private readonly bobToken: Address,
  ) {}

  getAmountOut(
    fromToken: Address,
    toToken: Address,
    fromAmounts: bigint[],
    bobBalance: bigint,
  ): bigint[] | null {
    fromToken = fromToken.toLowerCase();
    toToken = toToken.toLowerCase();
    try {
      if (toToken.toLowerCase() === this.bobToken.toLowerCase()) {
        return this.buyBob(fromToken, fromAmounts, bobBalance);
      } else if (fromToken.toLowerCase() === this.bobToken.toLowerCase()) {
        return this.sellBob(toToken, fromAmounts);
      } else {
        return this.swap(fromToken, toToken, fromAmounts, bobBalance);
      }
    } catch (e) {
      handleMathError(e, this.logger);
      return null;
    }
  }

  buyBob(
    fromToken: Address,
    fromAmounts: bigint[],
    bobBalance: bigint,
  ): bigint[] | null {
    try {
      const state = this.state.collaterals[fromToken];
      return fromAmounts.map(inAmount => {
        if (state.price === 0n || state.inFee > MAX_FEE) {
          return 0n;
        }

        const fee = (inAmount * state.inFee) / DENOMINATOR;
        const sellAmount = inAmount - fee;
        const outAmount = (sellAmount * DENOMINATOR) / state.price;

        if (
          outAmount > bobBalance ||
          state.balance + sellAmount > state.maxBalance
        ) {
          return 0n;
        }

        return outAmount;
      });
    } catch (e) {
      handleMathError(e, this.logger);
      return null;
    }
  }

  sellBob(toToken: Address, fromAmounts: bigint[]): bigint[] | null {
    try {
      const state = this.state.collaterals[toToken];
      return fromAmounts.map(inAmount => {
        if (state.price === 0n || state.outFee > MAX_FEE) {
          return 0n;
        }

        let outAmount = (inAmount * state.price) / DENOMINATOR;

        if (state.balance < outAmount) {
          return 0n;
        }

        outAmount -= (outAmount * state.outFee) / DENOMINATOR;

        return outAmount;
      });
    } catch (e) {
      handleMathError(e, this.logger);
      return null;
    }
  }

  swap(
    fromToken: Address,
    toToken: Address,
    fromAmounts: bigint[],
    bobBalance: bigint,
  ): bigint[] | null {
    try {
      const inState = this.state.collaterals[fromToken];
      const outState = this.state.collaterals[toToken];
      return fromAmounts.map(inAmount => {
        if (
          inState.price === 0n ||
          outState.price === 0n ||
          inState.inFee > MAX_FEE ||
          outState.outFee > MAX_FEE
        ) {
          return 0n;
        }
        const fee = (inAmount * inState.inFee) / DENOMINATOR;
        const sellAmount = inAmount - fee;
        const bobAmount = (sellAmount * DENOMINATOR) / inState.price;
        let outAmount = (bobAmount * outState.price) / DENOMINATOR;

        if (
          outState.balance < outAmount ||
          sellAmount + inState.balance > inState.maxBalance
        ) {
          return 0n;
        }

        outAmount -= (outAmount * outState.outFee) / DENOMINATOR;

        return outAmount;
      });
    } catch (e) {
      handleMathError(e, this.logger);
      return null;
    }
  }
}
