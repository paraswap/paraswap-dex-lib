import { Address, NumberAsString, Token } from '../../types';

export type UniswapDataLegacy = {
  router: Address;
  path: Address[];
  factory: Address;
  initCode: string;
  fee: number[];
  feeFactor: number;
};

export type UniswapData = {
  router: Address;
  pools: UniswapPool[];
  weth?: Address;
};

export enum UniswapV2Functions {
  swap = 'swap',
  buy = 'buy',
  swapOnUniswap = 'swapOnUniswap',
  buyOnUniswap = 'buyOnUniswap',
  swapOnUniswapFork = 'swapOnUniswapFork',
  buyOnUniswapFork = 'buyOnUniswapFork',
  swapOnUniswapV2Fork = 'swapOnUniswapV2Fork',
  buyOnUniswapV2Fork = 'buyOnUniswapV2Fork',
  swapOnUniswapV2ForkWithPermit = 'swapOnUniswapV2ForkWithPermit',
  buyOnUniswapV2ForkWithPermit = 'buyOnUniswapV2ForkWithPermit',
}

export type SwapOnUniswapParam = [
  amountIn: NumberAsString,
  amountOutMin: NumberAsString,
  path: Address[],
];

export type BuyOnUniswapParam = [
  amountInMax: NumberAsString,
  amountOut: NumberAsString,
  path: Address[],
];

export type SwapOnUniswapForkParam = [
  factory: Address,
  initCode: string,
  amountIn: NumberAsString,
  amountOutMin: NumberAsString,
  path: Address[],
];

export type BuyOnUniswapForkParam = [
  factory: Address,
  initCode: string,
  amountInMax: NumberAsString,
  amountOut: NumberAsString,
  path: Address[],
];

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
  | SwapOnUniswapParam
  | BuyOnUniswapParam
  | SwapOnUniswapForkParam
  | BuyOnUniswapForkParam
  | SwapOnUniswapV2ForkParam
  | BuyOnUniswapV2ForkParam
  | SwapOnUniswapV2ForkWithPermitParam
  | BuyOnUniswapV2ForkWithPermitParam;

export type UniswapPool = {
  address: Address;
  direction: boolean;
  fee: number;
};

export type UniswapV2Data = {
  router: Address;
  path: Address[];
  pools: {
    address: Address;
    direction: boolean;
    fee: number;
  }[];
  factory: Address;
  initCode: string;
  feeFactor: number;
  wethAddress?: string;
};

export type DexParams = {
  subgraphURL?: string;
  factoryAddress: Address;
  initCode: string;
  poolGasCost?: number;
  feeCode: number;
  router?: Address;
  adapters?: { [side: string]: { name: string; index: number }[] | null };
};
