export * from '../uniswap-v3/types';

export type QuoteExactInputSingleParams = {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  fee: bigint;
  sqrtPriceLimitX96: bigint;
};

export type QuoteExactOutputSingleParams = {
  tokenIn: string;
  tokenOut: string;
  amount: bigint;
  fee: bigint;
  sqrtPriceLimitX96: bigint;
};
