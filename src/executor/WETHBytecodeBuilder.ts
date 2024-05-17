import { DexExchangeBuildParam } from '../types';
import { OptimalRate, SwapSide } from '@paraswap/core';
import { isETHAddress } from '../utils';
import { DepositWithdrawReturn } from '../dex/weth/types';
import { WethConfig } from '../dex/weth/config';
import { Executors, Flag, SpecialDex } from './types';
import { ExecutorBytecodeBuilder } from './ExecutorBytecodeBuilder';
import { Network } from '../constants';

const SUPPORTED_NETWORKS = [
  Network.MAINNET,
  Network.AVALANCHE,
  Network.BSC,
  Network.BASE,
  Network.POLYGON,
  Network.OPTIMISM,
  Network.ZKEVM,
];
const SUPPORTED_EXCHANGES = Object.keys(WethConfig);

export const isSingleWrapRoute = (priceRoute: OptimalRate): boolean => {
  //note: FANTOM and ARBITRUM doesnt support fallback deposit case

  const isSingleSwap =
    priceRoute.bestRoute.length === 1 &&
    priceRoute.bestRoute[0].swaps.length === 1 &&
    priceRoute.bestRoute[0].swaps[0].swapExchanges.length === 1;

  const { exchange } = priceRoute.bestRoute[0].swaps[0].swapExchanges[0];

  const isWethExchange = SUPPORTED_EXCHANGES.includes(exchange);
  const supportedNetwork = SUPPORTED_NETWORKS.includes(priceRoute.network);

  const isWrap = isETHAddress(priceRoute.srcToken);

  return supportedNetwork && isSingleSwap && isWethExchange && isWrap;
};

/**
 * Class to build bytecode for WETH - simple optimisation for a single ETH->WETH Swap
 */
export class WETHBytecodeBuilder extends ExecutorBytecodeBuilder {
  type = Executors.WETH;
  /**
   * WETH Flags:
   * switch (flag % 4):
   * case 0: don't instert fromAmount
   * case 1: sendEth equal to fromAmount
   * case 2: sendEth equal to fromAmount + insert fromAmount
   * case 3: insert fromAmount

   * switch (flag % 3):
   * case 0: don't check balance after swap
   * case 1: check eth balance after swap
   * case 2: check destToken balance after swap
   */
  protected buildSimpleSwapFlags(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeBuildParam[],
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParamIndex: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag } {
    return {
      dexFlag:
        Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP,
      approveFlag: 0,
    };
  }

  /**
   * WETH Flags:
   * switch (flag % 4):
   * case 0: don't insert fromAmount
   * case 1: sendEth equal to fromAmount
   * case 2: sendEth equal to fromAmount + insert fromAmount
   * case 3: insert fromAmount

   * switch (flag % 3):
   * case 0: don't check balance after swap
   * case 1: check eth balance after swap
   * case 2: check destToken balance after swap
   */
  // Executor01 doesn't support mega swap routes, flags are built for multi swap routes only here
  protected buildMultiMegaSwapFlags(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeBuildParam[],
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParamIndex: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag } {
    return {
      dexFlag:
        Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP,
      approveFlag: 0,
    };
  }

  protected buildSingleSwapCallData(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeBuildParam[],
    index: number,
    flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag },
    sender: string,
    maybeWethCallData?: DepositWithdrawReturn,
  ): string {
    return '0x';
  }

  protected buildDexCallData(
    priceRoute: OptimalRate,
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParams: DexExchangeBuildParam[],
    exchangeParamIndex: number,
    isLastSwap: boolean,
    flag: Flag,
  ): string {
    return '0x';
  }

  public getAddress(): string {
    return this.dexHelper.config.data.wrappedNativeTokenAddress;
  }

  public buildByteCode(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeBuildParam[],
    sender: string,
    maybeWethCallData?: DepositWithdrawReturn,
  ): string {
    return '0x';
  }
}
