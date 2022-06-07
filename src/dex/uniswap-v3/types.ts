import { NumberAsString } from '../../types';
import { Address } from '../../types';

export type PoolState = {
  // TODO: poolState is the state of event
  // subscriber. This should be the minimum
  // set of parameters required to compute
  // pool prices. Complete me!
};

export type UniswapV3Data = {
  // ExactInputSingleParams
  fee: number;
  deadline?: number;
  sqrtPriceLimitX96?: NumberAsString;
};

export type DexParams = {
  router: Address;
};

export type UniswapV3SellParam = {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  deadline: number;
  amountIn: NumberAsString;
  amountOutMinimum: NumberAsString;
  sqrtPriceLimitX96: NumberAsString;
};

export type UniswapV3BuyParam = {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  deadline: number;
  amountOut: NumberAsString;
  amountInMaximum: NumberAsString;
  sqrtPriceLimitX96: NumberAsString;
};

export type UniswapV3Param = UniswapV3SellParam | UniswapV3BuyParam;

export enum UniswapV3Functions {
  exactInputSingle = 'exactInputSingle',
  exactOutputSingle = 'exactOutputSingle',
}
