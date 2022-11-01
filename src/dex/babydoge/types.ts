import { Address } from '../../types';

export type BabydogeSwapDataLegacy = {
  router: Address;
  path: Address[];
  factory: Address;
  fee: number[];
  feeFactor: number;
};

export enum BabydogeSwapFunctions {
  swapETHForExactTokens = 'swapETHForExactTokens',
  swapExactETHForTokens = 'swapExactETHForTokens',
  swapExactETHForTokensSupportingFeeOnTransferTokens = 'swapExactETHForTokensSupportingFeeOnTransferTokens',
  swapExactTokensForETH = 'swapExactTokensForETH',
  swapExactTokensForETHSupportingFeeOnTransferTokens = 'swapExactTokensForETHSupportingFeeOnTransferTokens',
  swapExactTokensForTokens = 'swapExactTokensForTokens',
  swapExactTokensForTokensSupportingFeeOnTransferTokens = 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
  swapTokensForExactETH = 'swapTokensForExactETH',
  swapTokensForExactTokens = 'swapTokensForExactTokens',
}

export type SwapOnBabydogeSwapParam = [
  srcAmount: string,
  destAmount: string,
  path: string[],
  to: string,
  deadline: string,
];

export type BuyOnBabydogeSwapParam = [
  srcAmount: string,
  destAmount: string,
  path: string[],
  to: string,
  deadline: string,
];

export type SwapOnETHBabydogeSwapParam = [
  destAmount: string,
  path: string[],
  to: string,
  deadline: string,
];

export type BuyOnETHBabydogeSwapParam = [
  destAmount: string,
  path: string[],
  to: string,
  deadline: string,
];

export type BabydogeSwapParam =
  | SwapOnBabydogeSwapParam
  | BuyOnBabydogeSwapParam
  | SwapOnETHBabydogeSwapParam
  | BuyOnETHBabydogeSwapParam;

export type BabydogeSwapPool = {
  address: Address;
  direction: boolean;
  fee: number;
};

export type BabydogeSwapData = {
  router: Address;
  path: Address[];
  pools: {
    address: Address;
    direction: boolean;
    fee: number;
  }[];
  factory: Address;
  feeFactor: number;
  weth?: string;
  isFeeOnTransferSupported?: boolean;
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
