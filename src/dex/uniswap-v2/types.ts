import { Address, NumberAsString, Token } from '../../types';

export enum UniswapV2Functions {
  swap = 'swap',
  buy = 'buy',
  swapOnUniswapV2Fork = 'swapOnUniswapV2Fork',
  buyOnUniswapV2Fork = 'buyOnUniswapV2Fork',
  swapOnUniswapV2ForkWithPermit = 'swapOnUniswapV2ForkWithPermit',
  buyOnUniswapV2ForkWithPermit = 'buyOnUniswapV2ForkWithPermit',
}

export type SwapOnUniswapV2ForkParam = [
  tokenIn: Address,
  amountIn: NumberAsString,
  amountOutMin: NumberAsString,
  weth: Address,
  pools: NumberAsString[],
];

export type BuyOnUniswapV2ForkParam = [
  tokenIn: Address,
  amountInMax: NumberAsString,
  amountOut: NumberAsString,
  weth: Address,
  pools: NumberAsString[],
];

export type SwapOnUniswapV2ForkWithPermitParam = [
  tokenIn: Address,
  amountIn: NumberAsString,
  amountOutMin: NumberAsString,
  weth: Address,
  pools: NumberAsString[],
  permit: string,
];

export type BuyOnUniswapV2ForkWithPermitParam = [
  tokenIn: Address,
  amountInMax: NumberAsString,
  amountOut: NumberAsString,
  weth: Address,
  pools: NumberAsString[],
  permit: string,
];

export type UniswapParam =
  | SwapOnUniswapV2ForkParam
  | BuyOnUniswapV2ForkParam
  | SwapOnUniswapV2ForkWithPermitParam
  | BuyOnUniswapV2ForkWithPermitParam;

export type UniswapV2Data = {
  router: Address;
  pools: UniswapPool[];
};

export type DexParams = {
  subgraphURL?: string;
  factoryAddress: Address;
  poolGasCost?: number;
  feeCode: number;
  router?: Address;
  adapters?: { [side: string]: { name: string; index: number }[] | null };
};

export type UniswapPool = {
  address: Address;
  direction: boolean;
  fee: number;
};
