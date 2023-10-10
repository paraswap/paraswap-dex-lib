// event Sync (uint256 reserve0, uint256 reserve1, uint256 fictiveReserve0, uint256 fictiveReserve1, uint256 priceAverage0, uint256 priceAverage1)
import { SmardexFees } from './types';

export enum TOPICS {
  SYNC_EVENT = '0x2a368c7f33bb86e2d999940a3989d849031aff29b750f67947e6b8e8c3d2ffd6',
  SWAP_EVENT = '0xa4228e1eb11eb9b31069d9ed20e7af9a010ca1a02d4855cee54e08e188fcc32c',
  FEES_EVENT = '0x64f84976d9c917a44796104a59950fdbd9b3c16a5dd348b546d738301f6bd068',
  // PAIR_CREATED_EVENT = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9',
}

export enum SmardexRouterFunctions {
  sellExactEth = 'swapExactETHForTokens',
  sellExactToken = 'swapExactTokensForETH',
  swapExactIn = 'swapExactTokensForTokens',
  buyExactEth = 'swapTokensForExactETH',
  buyExactToken = 'swapETHForExactTokens',
  swapExactOut = 'swapTokensForExactTokens',
}

export const directSmardexFunctionName = [
  SmardexRouterFunctions.sellExactEth,
  SmardexRouterFunctions.sellExactToken,
  SmardexRouterFunctions.swapExactIn,
  SmardexRouterFunctions.buyExactEth,
  SmardexRouterFunctions.buyExactToken,
  SmardexRouterFunctions.swapExactOut,
];

export const SUBGRAPH_TIMEOUT = 20 * 1000;

export const DefaultSmardexPoolGasCost = 130 * 1000;

export const FEES_LAYER_ONE: SmardexFees = {
  feesLP: 500n,
  feesPool: 200n,
};
