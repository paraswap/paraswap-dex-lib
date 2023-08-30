import { DexParams as UniswapV2DexParams } from '../uniswap-v2/types';
import { SolidlyPoolOrderedParams } from '../solidly/types';

export type CamelotPoolState = {
  reserve0: string;
  reserve1: string;
  token0FeeCode: number;
  token1FeeCode: number;
  stable: boolean;
};

// to calculate prices for stable pool, we need decimals of the stable tokens
export type CamelotPoolOrderedParams = SolidlyPoolOrderedParams;

export type DexParams = UniswapV2DexParams;
