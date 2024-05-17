import { DexExchangeBuildParam } from '../types';
import { OptimalRate, SwapSide } from '@paraswap/core';
import { isETHAddress } from '../utils';
import { DepositWithdrawReturn } from '../dex/weth/types';
import { WethConfig } from '../dex/weth/config';
import { Executors, Flag, SpecialDex } from './types';
import { ExecutorBytecodeBuilder } from './ExecutorBytecodeBuilder';
import { Network } from '../constants';

export const isSingleWrapRoute = (priceRoute: OptimalRate): boolean => {
  const wrappedExchanges = Object.keys(WethConfig);

  //note: FANTOM and ARBITRUM doesnt support fallback deposit case
  const supportedNetwork = [
    Network.MAINNET,
    Network.AVALANCHE,
    Network.BSC,
    Network.BASE,
    Network.POLYGON,
    Network.OPTIMISM,
  ].includes(priceRoute.network);

  const isSingleSwap =
    priceRoute.bestRoute.length === 1 &&
    priceRoute.bestRoute[0].swaps.length === 1 &&
    priceRoute.bestRoute[0].swaps[0].swapExchanges.length === 1;

  const { exchange } = priceRoute.bestRoute[0].swaps[0].swapExchanges[0];
  const isWethExchange = wrappedExchanges.includes(exchange);
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
    const { srcToken, destToken } =
      priceRoute.bestRoute[routeIndex].swaps[swapIndex];
    const isEthSrc = isETHAddress(srcToken);
    const isEthDest = isETHAddress(destToken);

    const exchangeParam = exchangeParams[exchangeParamIndex];
    const {
      dexFuncHasRecipient,
      needWrapNative,
      specialDexFlag,
      specialDexSupportsInsertFromAmount,
      swappedAmountNotPresentInExchangeData,
    } = exchangeParam;

    const needWrap = needWrapNative && isEthSrc && maybeWethCallData?.deposit;
    const needUnwrap =
      needWrapNative && isEthDest && maybeWethCallData?.withdraw;
    const isSpecialDex =
      specialDexFlag !== undefined && specialDexFlag !== SpecialDex.DEFAULT;

    const forcePreventInsertFromAmount =
      swappedAmountNotPresentInExchangeData ||
      (isSpecialDex && !specialDexSupportsInsertFromAmount);

    let dexFlag = forcePreventInsertFromAmount
      ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP
      : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 0 or 3
    let approveFlag =
      Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 0

    if (isEthSrc && !needWrap) {
      dexFlag =
        Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 5
    } else if (isEthDest && !needUnwrap) {
      dexFlag = forcePreventInsertFromAmount
        ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP
        : Flag.INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP; // 4 or 7
    } else if (!dexFuncHasRecipient || (isEthDest && needUnwrap)) {
      dexFlag = forcePreventInsertFromAmount
        ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP
        : Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 8 or 11
    }

    return {
      dexFlag,
      approveFlag,
    };
  }

  /**
   * Executor01 Flags:
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
    // same as for Executor02 multi flags, except forceBalanceOfCheck
    const swap = priceRoute.bestRoute[routeIndex].swaps[swapIndex];
    const { srcToken, destToken } = swap;
    const exchangeParam = exchangeParams[exchangeParamIndex];
    const {
      dexFuncHasRecipient,
      needWrapNative,
      specialDexFlag,
      specialDexSupportsInsertFromAmount,
      swappedAmountNotPresentInExchangeData,
      sendEthButSupportsInsertFromAmount,
    } = exchangeParam;

    const isLastSwap =
      swapIndex === priceRoute.bestRoute[routeIndex].swaps.length - 1;
    const isEthSrc = isETHAddress(srcToken);
    const isEthDest = isETHAddress(destToken);

    const isSpecialDex =
      specialDexFlag !== undefined && specialDexFlag !== SpecialDex.DEFAULT;

    const forcePreventInsertFromAmount =
      swappedAmountNotPresentInExchangeData ||
      (isSpecialDex && !specialDexSupportsInsertFromAmount);

    const needUnwrap =
      needWrapNative && isEthDest && maybeWethCallData?.withdraw;

    const forceBalanceOfCheck = isLastSwap
      ? !dexFuncHasRecipient || needUnwrap
      : true;

    const needSendEth = isEthSrc && !needWrapNative;
    const needCheckEthBalance = isEthDest && !needWrapNative;

    const needCheckSrcTokenBalanceOf = needUnwrap && !isLastSwap;

    let dexFlag: Flag;
    let approveFlag =
      Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 0

    if (needSendEth) {
      const preventInsertForSendEth =
        forcePreventInsertFromAmount || !sendEthButSupportsInsertFromAmount;
      dexFlag = forceBalanceOfCheck
        ? preventInsertForSendEth
          ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 5
          : Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_PLUS_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 14
        : dexFuncHasRecipient
        ? preventInsertForSendEth
          ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 9
          : Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_PLUS_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 18
        : preventInsertForSendEth
        ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 5
        : Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_PLUS_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 18
    } else if (needCheckEthBalance) {
      dexFlag =
        needCheckSrcTokenBalanceOf || forceBalanceOfCheck
          ? forcePreventInsertFromAmount && dexFuncHasRecipient
            ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP // 4
            : Flag.INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP // 7
          : forcePreventInsertFromAmount && dexFuncHasRecipient
          ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 0
          : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
    } else {
      dexFlag =
        needCheckSrcTokenBalanceOf || forceBalanceOfCheck
          ? forcePreventInsertFromAmount
            ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 8
            : Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 11
          : forcePreventInsertFromAmount
          ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 0
          : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
    }

    return {
      dexFlag,
      approveFlag,
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
