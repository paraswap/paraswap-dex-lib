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

export type UniswapParam =
  | SwapOnUniswapParam
  | BuyOnUniswapParam
  | SwapOnUniswapForkParam
  | BuyOnUniswapForkParam;

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
  subgraphURL: string;
  factoryAddress: Address;
  initCode: string;
  poolGasCost?: number;
  feeCode: number;
};
