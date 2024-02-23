import { ethers } from 'ethers';
import {
  OptimalRoute,
  OptimalRate,
  OptimalSwap,
  OptimalSwapExchange,
} from '@paraswap/core';
import { DexExchangeParam } from '../types';
import { Executors, Flag, SpecialDex } from './types';
import { isETHAddress } from '../utils';
import { DepositWithdrawReturn } from '../dex/weth/types';
import { ExecutorBytecodeBuilder } from './ExecutorBytecodeBuilder';
import {
  BYTES_64_LENGTH,
  NOT_EXISTING_EXCHANGE_PARAM_INDEX,
  SWAP_EXCHANGE_100_PERCENTAGE,
  ZEROS_20_BYTES,
  ZEROS_28_BYTES,
  ZEROS_4_BYTES,
} from './constants';
import { MAX_UINT } from '../constants';

const {
  utils: { hexlify, hexDataLength, hexConcat, hexZeroPad, solidityPack },
} = ethers;

/**
 * Class to build bytecode for Executor02 - simpleSwap with N DEXs (VERTICAL_BRANCH), multiSwaps (VERTICAL_BRANCH_HORIZONTAL_SEQUENCE) and megaswaps (NESTED_VERTICAL_BRANCH_HORIZONTAL_SEQUENCE)
 */
export class Executor02BytecodeBuilder extends ExecutorBytecodeBuilder {
  type = Executors.TWO;
  /**
   * Executor02 Flags:
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
    exchangeParam: DexExchangeParam,
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

    const { dexFuncHasRecipient, needWrapNative } = exchangeParam;

    const needWrap = needWrapNative && isEthSrc && maybeWethCallData?.deposit;
    const needUnwrap =
      needWrapNative && isEthDest && maybeWethCallData?.withdraw;

    let dexFlag = Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 0
    let approveFlag =
      Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 0

    if (isEthSrc && !needWrap) {
      dexFlag =
        Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 5
    } else if (isEthDest && !needUnwrap) {
      dexFlag = Flag.DONT_INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP; // 4
    } else if (!dexFuncHasRecipient || (isEthDest && needUnwrap)) {
      dexFlag = Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 8
    }

    return {
      dexFlag,
      approveFlag,
    };
  }

  /**
   * Executor02 Flags:
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
  protected buildMultiMegaSwapFlags(
    priceRoute: OptimalRate,
    exchangeParam: DexExchangeParam,
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParamIndex: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag } {
    const route = priceRoute.bestRoute[routeIndex];
    const swap = route.swaps[swapIndex];
    const swapExchange = swap.swapExchanges[swapExchangeIndex];

    const { srcToken, destToken } = swap;
    const isEthSrc = isETHAddress(srcToken);
    const isEthDest = isETHAddress(destToken);

    const applyVerticalBranching = this.doesSwapNeedToApplyVerticalBranching(
      priceRoute,
      routeIndex,
      swap,
    );

    const isHorizontalSequence = route.swaps.length > 1; // check if route is a multi-swap (horizontal sequence)
    const isFirstSwap = swapIndex === 0;
    const isLastSwap = !isFirstSwap && swapIndex === route.swaps.length - 1;

    const {
      dexFuncHasRecipient,
      needWrapNative,
      specialDexFlag,
      exchangeData,
      specialDexSupportsInsertFromAmount,
    } = exchangeParam;

    const doesExchangeDataContainsSrcAmount =
      exchangeData.indexOf(
        ethers.utils.defaultAbiCoder
          .encode(['uint256'], [swapExchange.srcAmount])
          .replace('0x', ''),
      ) > -1;

    const isSpecialDex =
      specialDexFlag !== undefined && specialDexFlag !== SpecialDex.DEFAULT;

    const needWrap = needWrapNative && isEthSrc && maybeWethCallData?.deposit;
    const needUnwrap =
      needWrapNative && isEthDest && maybeWethCallData?.withdraw;

    const forcePreventInsertFromAmount =
      !doesExchangeDataContainsSrcAmount ||
      (isSpecialDex && !specialDexSupportsInsertFromAmount);
    const forceBalanceOfCheck =
      isSpecialDex &&
      isHorizontalSequence &&
      !applyVerticalBranching &&
      !isLastSwap;

    let dexFlag = forcePreventInsertFromAmount
      ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 0
      : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
    let approveFlag =
      Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 0

    if (isFirstSwap) {
      if (
        (applyVerticalBranching && !isSpecialDex && !isEthSrc) ||
        (isSpecialDex && needWrap)
      ) {
        // keep default flags
      } else if (isEthSrc && !needWrap) {
        dexFlag =
          (isHorizontalSequence && !applyVerticalBranching) ||
          forceBalanceOfCheck
            ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 5
            : dexFuncHasRecipient
            ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 9
            : Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 5
      } else if (
        (isEthSrc && needWrap) ||
        (!isEthSrc && !isEthDest) ||
        (isEthDest && needUnwrap)
      ) {
        dexFlag =
          (isHorizontalSequence && !applyVerticalBranching) ||
          forceBalanceOfCheck
            ? forcePreventInsertFromAmount
              ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 8
              : Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 11
            : forcePreventInsertFromAmount
            ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 0
            : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      } else if (isEthDest && !needUnwrap) {
        dexFlag =
          (isHorizontalSequence && !applyVerticalBranching) ||
          forceBalanceOfCheck
            ? forcePreventInsertFromAmount
              ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP // 4
              : Flag.INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP // 7
            : forcePreventInsertFromAmount
            ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 0
            : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      } else if (isEthDest && needUnwrap) {
        dexFlag = forcePreventInsertFromAmount
          ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 0
          : Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11
      } else if (!dexFuncHasRecipient) {
        dexFlag = forcePreventInsertFromAmount
          ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 0
          : Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11
      }
    } else {
      if (isSpecialDex && !isLastSwap) {
        // keep default flags
      } else if (isEthSrc && !needWrap && !isSpecialDex) {
        dexFlag =
          (isHorizontalSequence && !isLastSwap) || forceBalanceOfCheck
            ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 5
            : Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 9
      } else if (isEthSrc && needWrap && !isSpecialDex) {
        dexFlag = forcePreventInsertFromAmount
          ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 0
          : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      } else if (needUnwrap && !isSpecialDex) {
        dexFlag =
          (isHorizontalSequence && !isLastSwap) || forceBalanceOfCheck
            ? forcePreventInsertFromAmount
              ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 8
              : Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 11
            : forcePreventInsertFromAmount
            ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP //0
            : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      } else if (isSpecialDex) {
        if (isEthDest && !needUnwrap) {
          dexFlag =
            (isHorizontalSequence && !isLastSwap && !applyVerticalBranching) ||
            forceBalanceOfCheck
              ? forcePreventInsertFromAmount
                ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP // 4
                : Flag.INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP // 7
              : forcePreventInsertFromAmount
              ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 0
              : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
        } else if (isEthSrc && !needWrap) {
          dexFlag =
            !dexFuncHasRecipient ||
            (isHorizontalSequence && !isLastSwap && !applyVerticalBranching)
              ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 5
              : Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 9
        } else {
          dexFlag =
            (isHorizontalSequence && !isLastSwap && !applyVerticalBranching) ||
            forceBalanceOfCheck
              ? forcePreventInsertFromAmount
                ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 8
                : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 3
              : forcePreventInsertFromAmount
              ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 8
              : Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11
        }
      } else if (!dexFuncHasRecipient) {
        dexFlag = forcePreventInsertFromAmount
          ? Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 8
          : Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11
      } else {
        dexFlag = forcePreventInsertFromAmount
          ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 0
          : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      }
    }

    return {
      dexFlag,
      approveFlag,
    };
  }

  protected buildDexCallData(
    priceRoute: OptimalRate,
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParams: DexExchangeParam[],
    exchangeParamIndex: number,
    isLastSwap: boolean,
    flag: Flag,
    swapExchange: OptimalSwapExchange<any>,
  ): string {
    const swap = priceRoute.bestRoute[routeIndex].swaps[swapIndex];
    let { exchangeData, specialDexFlag, targetExchange, needWrapNative } =
      exchangeParams[exchangeParamIndex];

    const applyVerticalBranching = this.doesSwapNeedToApplyVerticalBranching(
      priceRoute,
      routeIndex,
      swap,
    );
    const isLastSwapExchange =
      swapExchangeIndex === swap.swapExchanges.length - 1;
    const dontCheckBalanceAfterSwap = flag % 3 === 0;
    const checkDestTokenBalanceAfterSwap = flag % 3 === 2;
    const insertFromAmount = flag % 4 === 3;

    const srcTokenAddress =
      isETHAddress(swap.srcToken) && needWrapNative
        ? this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase()
        : swap.srcToken.toLowerCase();

    const destTokenAddress =
      isETHAddress(swap.destToken) && needWrapNative
        ? this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase()
        : swap.destToken.toLowerCase();

    exchangeData = this.addTokenAddressToCallData(
      exchangeData,
      srcTokenAddress,
    );

    if (
      (applyVerticalBranching && isLastSwapExchange) ||
      (checkDestTokenBalanceAfterSwap && !dontCheckBalanceAfterSwap)
    ) {
      exchangeData = this.addTokenAddressToCallData(
        exchangeData,
        destTokenAddress,
      );
    }

    let destTokenPos = 0;
    if (checkDestTokenBalanceAfterSwap && !dontCheckBalanceAfterSwap) {
      const destTokenAddrIndex = exchangeData
        .replace('0x', '')
        .indexOf(destTokenAddress.replace('0x', ''));
      destTokenPos = (destTokenAddrIndex - 24) / 2;
    }

    let fromAmountPos = 0;
    if (insertFromAmount) {
      const fromAmount = ethers.utils.defaultAbiCoder.encode(
        ['uint256'],
        [swapExchange.srcAmount],
      );
      const fromAmountIndex = exchangeData
        .replace('0x', '')
        .indexOf(fromAmount.replace('0x', ''));

      fromAmountPos = fromAmountIndex / 2;
    }

    return this.buildCallData(
      targetExchange,
      exchangeData,
      fromAmountPos,
      destTokenPos,
      specialDexFlag || SpecialDex.DEFAULT,
      flag,
    );
  }

  private addMultiSwapMetadata(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    callData: string,
    percentage: number,
    swap: OptimalSwap,
    exchangeParamIndex: number,
    wrapWasAddedInSwapExchange: boolean,
  ) {
    let srcTokenAddress = swap.srcToken;

    let doesAnyDexOnSwapNeedsWrapNative: boolean;
    if (exchangeParamIndex > -1) {
      doesAnyDexOnSwapNeedsWrapNative =
        isETHAddress(srcTokenAddress) &&
        exchangeParams[exchangeParamIndex].needWrapNative;
    } else {
      doesAnyDexOnSwapNeedsWrapNative =
        isETHAddress(srcTokenAddress) &&
        this.anyDexOnSwapNeedsWrapNative(priceRoute, swap, exchangeParams);
    }

    if (
      doesAnyDexOnSwapNeedsWrapNative &&
      isETHAddress(srcTokenAddress) &&
      !wrapWasAddedInSwapExchange
    ) {
      srcTokenAddress = this.dexHelper.config.data.wrappedNativeTokenAddress;
    }

    let srcTokenAddressLowered = srcTokenAddress.toLowerCase();
    let srcTokenPos: string;

    if (percentage === SWAP_EXCHANGE_100_PERCENTAGE) {
      srcTokenPos = hexZeroPad(hexlify(0), 8);
    } else if (isETHAddress(srcTokenAddressLowered)) {
      srcTokenPos = '0xEEEEEEEEEEEEEEEE';
    } else {
      const srcTokenAddrIndex = callData
        .replace('0x', '')
        .indexOf(srcTokenAddressLowered.replace('0x', ''));

      srcTokenPos = hexZeroPad(hexlify(srcTokenAddrIndex / 2), 8);
    }

    return solidityPack(
      ['bytes16', 'bytes8', 'bytes8', 'bytes'],
      [
        hexZeroPad(hexlify(hexDataLength(callData)), 16), // calldata size
        srcTokenPos, // srcTokenPos
        hexZeroPad(hexlify(Math.round(percentage * 100)), 8), // percentage
        callData, // swap calldata
      ],
    );
  }

  private packVerticalBranchingData(swapCallData: string): string {
    return solidityPack(
      ['bytes28', 'bytes4', 'bytes32', 'bytes32', 'bytes'],
      [
        ZEROS_28_BYTES, // empty bytes28
        ZEROS_4_BYTES, // fallback selector
        hexZeroPad(hexlify(32), 32), // calldata offset
        hexZeroPad(hexlify(hexDataLength(swapCallData)), 32), // calldata length
        swapCallData, // calldata
      ],
    );
  }

  private packVerticalBranchingCallData(
    verticalBranchingData: string,
    fromAmountPos: number,
    destTokenPos: number,
    flag: Flag,
  ): string {
    return solidityPack(
      [
        'bytes20',
        'bytes4',
        'bytes2',
        'bytes2',
        'bytes1',
        'bytes1',
        'bytes2',
        'bytes',
      ],
      [
        ZEROS_20_BYTES, // bytes20(0)
        hexZeroPad(hexlify(hexDataLength(verticalBranchingData)), 4), // dex calldata length
        hexZeroPad(hexlify(fromAmountPos), 2), // fromAmountPos
        hexZeroPad(hexlify(destTokenPos), 2), // destTokenPos
        hexZeroPad(hexlify(0), 1), // returnAmountPos
        hexZeroPad(hexlify(SpecialDex.EXECUTE_VERTICAL_BRANCHING), 1), // special
        hexZeroPad(hexlify(flag), 2), // flag
        verticalBranchingData, // dexes calldata
      ],
    );
  }

  private buildVerticalBranchingCallData(
    priceRoute: OptimalRate,
    routeIndex: number,
    exchangeParams: DexExchangeParam[],
    swap: OptimalSwap,
    swapCallData: string,
    flag: Flag,
  ) {
    const data = this.packVerticalBranchingData(swapCallData);

    const destTokenAddrLowered = swap.destToken.toLowerCase();
    const isEthDest = isETHAddress(destTokenAddrLowered);

    let anyDexOnSwapNeedsWrapNative = false;
    let anyDexOnSwapDoesntNeedWrapNative = false;
    let destTokenPos: number;

    if (isEthDest) {
      anyDexOnSwapNeedsWrapNative = this.anyDexOnSwapNeedsWrapNative(
        priceRoute,
        swap,
        exchangeParams,
      );
      anyDexOnSwapDoesntNeedWrapNative = this.anyDexOnSwapDoesntNeedWrapNative(
        priceRoute,
        swap,
        exchangeParams,
      );
    }

    if (
      isEthDest &&
      anyDexOnSwapDoesntNeedWrapNative &&
      !anyDexOnSwapNeedsWrapNative
    ) {
      destTokenPos = 0;
    } else {
      const destTokenAddrIndex = data
        .replace('0x', '')
        .indexOf(
          (isEthDest
            ? this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase()
            : destTokenAddrLowered.toLowerCase()
          ).replace('0x', ''),
        );

      destTokenPos = destTokenAddrIndex / 2 - 40;
    }

    const fromAmountPos = hexDataLength(data) - 64 - 28; // 64 (position), 28 (selector padding);

    return this.packVerticalBranchingCallData(
      data,
      fromAmountPos,
      destTokenPos < 0 ? 0 : destTokenPos,
      flag,
    );
  }

  private buildSingleSwapExchangeCallData(
    priceRoute: OptimalRate,
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParams: DexExchangeParam[],
    flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag },
    addedWrapToSwapExchangeMap: { [key: string]: boolean },
    allowToAddWrap = true,
    maybeWethCallData?: DepositWithdrawReturn,
    addMultiSwapMetadata?: boolean,
    applyVerticalBranching?: boolean,
  ): string {
    const isSimpleSwap =
      priceRoute.bestRoute.length === 1 &&
      priceRoute.bestRoute[0].swaps.length === 1;
    let swapExchangeCallData = '';
    const swap = priceRoute.bestRoute[routeIndex].swaps[swapIndex];
    const swapExchange = swap.swapExchanges[swapExchangeIndex];

    let exchangeParamIndex = 0;
    let tempExchangeParamIndex = 0;

    priceRoute.bestRoute.map(route =>
      route.swaps.map(curSwap => {
        curSwap.swapExchanges.map(async se => {
          if (Object.is(se, swapExchange)) {
            exchangeParamIndex = tempExchangeParamIndex;
          }
          tempExchangeParamIndex++;
        });
      }),
    );

    const curExchangeParam = exchangeParams[exchangeParamIndex];

    const dexCallData = this.buildDexCallData(
      priceRoute,
      routeIndex,
      swapIndex,
      swapExchangeIndex,
      exchangeParams,
      exchangeParamIndex,
      false,
      flags.dexes[exchangeParamIndex],
      swapExchange,
    );

    swapExchangeCallData = hexConcat([dexCallData]);

    const isLastSwap =
      swapIndex === priceRoute.bestRoute[routeIndex].swaps.length - 1;
    const isLast = exchangeParamIndex === exchangeParams.length - 1;

    if (curExchangeParam.transferSrcTokenBeforeSwap) {
      const transferCallData = this.buildTransferCallData(
        this.erc20Interface.encodeFunctionData('transfer', [
          curExchangeParam.transferSrcTokenBeforeSwap,
          swapExchange.srcAmount,
        ]),
        isETHAddress(swap.srcToken)
          ? this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase()
          : swap.srcToken.toLowerCase(),
      );

      swapExchangeCallData = hexConcat([
        transferCallData,
        swapExchangeCallData,
      ]);
    }

    if (
      !isETHAddress(swap!.srcToken) &&
      !curExchangeParam.transferSrcTokenBeforeSwap
    ) {
      const approveCallData = this.buildApproveCallData(
        curExchangeParam.spender || curExchangeParam.targetExchange,
        isETHAddress(swap!.srcToken) && exchangeParamIndex !== 0
          ? this.dexHelper.config.data.wrappedNativeTokenAddress
          : swap!.srcToken,
        flags.approves[exchangeParamIndex],
      );

      swapExchangeCallData = hexConcat([approveCallData, swapExchangeCallData]);
    }

    if (curExchangeParam.needWrapNative && maybeWethCallData) {
      if (maybeWethCallData.deposit && isETHAddress(swap!.srcToken)) {
        const approveWethCalldata = this.buildApproveCallData(
          curExchangeParam.spender || curExchangeParam.targetExchange,
          this.dexHelper.config.data.wrappedNativeTokenAddress,
          flags.approves[exchangeParamIndex],
        );

        const isNotFirstSwap = swapIndex !== 0;
        let skipWrap = false;
        if (isNotFirstSwap) {
          const prevSwap =
            priceRoute.bestRoute[routeIndex].swaps[swapIndex - 1];
          const anyDexOnSwapDoesntNeedWrapNative =
            this.anyDexOnSwapDoesntNeedWrapNative(
              priceRoute,
              prevSwap,
              exchangeParams,
            );
          skipWrap = !anyDexOnSwapDoesntNeedWrapNative;
        }

        let depositCallData = '0x';
        if (
          !this.routeNeedsRootWrapEth(priceRoute, exchangeParams) &&
          allowToAddWrap &&
          !addedWrapToSwapExchangeMap[
            `${routeIndex}_${swapIndex}_${swapExchangeIndex}`
          ] &&
          !skipWrap
        ) {
          depositCallData = this.buildWrapEthCallData(
            maybeWethCallData.deposit.calldata,
            Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP, // 9
          );
          addedWrapToSwapExchangeMap[
            `${routeIndex}_${swapIndex}_${swapExchangeIndex}`
          ] = true;
        }

        swapExchangeCallData = hexConcat([
          approveWethCalldata,
          depositCallData,
          swapExchangeCallData,
        ]);
      }

      if (
        !applyVerticalBranching &&
        maybeWethCallData.withdraw &&
        isETHAddress(swap.destToken)
      ) {
        let withdrawCallData = '0x';

        const nextSwap = priceRoute.bestRoute[routeIndex].swaps[swapIndex + 1];

        let eachDexOnNextSwapNeedsWrapNative = false;
        if (nextSwap) {
          eachDexOnNextSwapNeedsWrapNative = this.eachDexOnSwapNeedsWrapNative(
            priceRoute,
            nextSwap,
            exchangeParams,
            routeIndex,
          );
        }

        const isLastSimpleWithUnwrap =
          isSimpleSwap &&
          // check if current exchange is the last with needWrapNative
          exchangeParams.reduceRight(
            (acc, obj, index) =>
              obj.needWrapNative === true && acc === -1 ? index : acc,
            -1,
          ) === exchangeParamIndex;

        if (
          (!isLast && !eachDexOnNextSwapNeedsWrapNative && nextSwap) || // unwrap if next swap has dexes which don't need wrap native
          isLastSimpleWithUnwrap // unwrap after last dex call with unwrap for simple swap case
        ) {
          withdrawCallData = this.buildUnwrapEthCallData(
            maybeWethCallData.withdraw.calldata,
          );
        }

        swapExchangeCallData = hexConcat([
          swapExchangeCallData,
          withdrawCallData,
        ]);

        if (isLastSimpleWithUnwrap) {
          const finalSpecialFlagCalldata = this.buildFinalSpecialFlagCalldata();
          swapExchangeCallData = hexConcat([
            swapExchangeCallData,
            finalSpecialFlagCalldata,
          ]);
        }
      }
    }

    if (
      isLastSwap &&
      !exchangeParams[exchangeParamIndex].dexFuncHasRecipient &&
      !isETHAddress(swap.destToken) &&
      priceRoute.destToken === swap.destToken
    ) {
      const transferCallData = this.buildTransferCallData(
        this.erc20Interface.encodeFunctionData('transfer', [
          this.dexHelper.config.data.augustusV6Address,
          swapExchange.destAmount,
        ]),
        swap.destToken,
      );

      swapExchangeCallData = hexConcat([
        swapExchangeCallData,
        transferCallData,
      ]);
    }

    if (
      !exchangeParams[exchangeParamIndex].dexFuncHasRecipient &&
      isETHAddress(swap.destToken) &&
      isLast
    ) {
      const finalSpecialFlagCalldata = this.buildFinalSpecialFlagCalldata();
      swapExchangeCallData = hexConcat([
        swapExchangeCallData,
        finalSpecialFlagCalldata,
      ]);
    }

    if (addMultiSwapMetadata) {
      return this.addMultiSwapMetadata(
        priceRoute,
        exchangeParams,
        swapExchangeCallData,
        swapExchange.percent,
        swap,
        exchangeParamIndex,
        addedWrapToSwapExchangeMap[
          `${routeIndex}_${swapIndex}_${swapExchangeIndex}`
        ],
      );
    }

    return swapExchangeCallData;
  }

  private appendWrapEthCallData(
    calldata: string,
    maybeWethCallData?: DepositWithdrawReturn,
    checkWethBalanceAfter = false,
  ) {
    if (maybeWethCallData?.deposit) {
      const callData = checkWethBalanceAfter
        ? this.addTokenAddressToCallData(
            maybeWethCallData.deposit.calldata,
            this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase(),
          )
        : maybeWethCallData.deposit.calldata;

      const depositCallData = this.buildWrapEthCallData(
        callData,
        checkWethBalanceAfter
          ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 5
          : Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP, // 9
        checkWethBalanceAfter ? 4 : 0,
      );

      return hexConcat([calldata, depositCallData]);
    }

    return calldata;
  }

  private eachDexOnSwapNeedsWrapNative(
    priceRoute: OptimalRate,
    swap: OptimalSwap,
    exchangeParams: DexExchangeParam[],
    routeIndex: number,
  ): boolean {
    return swap.swapExchanges.every(curSe => {
      let index = 0;
      let swapExchangeIndex = 0;
      priceRoute.bestRoute[routeIndex].swaps.map(curSwap =>
        curSwap.swapExchanges.map(async se => {
          if (Object.is(se, curSe)) {
            index = swapExchangeIndex;
          }
          swapExchangeIndex++;
        }),
      );

      const curExchangeParam = exchangeParams[index];

      return curExchangeParam.needWrapNative;
    });
  }

  private anyDexOnSwapNeedsWrapNative(
    priceRoute: OptimalRate,
    swap: OptimalSwap,
    exchangeParams: DexExchangeParam[],
  ): boolean {
    const res = swap.swapExchanges.map(curSe => {
      let index = 0;
      let swapExchangeIndex = 0;
      priceRoute.bestRoute.map(route => {
        route.swaps.map(curSwap => {
          return curSwap.swapExchanges.map(async se => {
            if (Object.is(se, curSe)) {
              index = swapExchangeIndex;
            }
            swapExchangeIndex++;
          });
        });
      });

      const curExchangeParam = exchangeParams[index];

      return curExchangeParam.needWrapNative;
    });

    return res.includes(true);
  }

  private anyDexOnSwapDoesntNeedWrapNative(
    priceRoute: OptimalRate,
    swap: OptimalSwap,
    exchangeParams: DexExchangeParam[],
  ): boolean {
    return swap.swapExchanges
      .map(curSe => {
        let index = 0;
        let swapExchangeIndex = 0;
        priceRoute.bestRoute.map(route => {
          route.swaps.map(curSwap =>
            curSwap.swapExchanges.map(async se => {
              if (Object.is(se, curSe)) {
                index = swapExchangeIndex;
              }
              swapExchangeIndex++;
            }),
          );
        });

        const curExchangeParam = exchangeParams[index];

        return !curExchangeParam.needWrapNative;
      })
      .includes(true);
  }

  private doesSwapNeedToApplyVerticalBranching(
    priceRoute: OptimalRate,
    routeIndex: number,
    swap: OptimalSwap,
  ): boolean {
    const isMegaSwap = priceRoute.bestRoute.length > 1;
    const isMultiSwap =
      !isMegaSwap && priceRoute.bestRoute[routeIndex].swaps.length > 1;

    return (isMultiSwap || isMegaSwap) && swap.swapExchanges.length > 1;
  }

  private buildVerticalBranchingFlag(
    priceRoute: OptimalRate,
    swap: OptimalSwap,
    exchangeParams: DexExchangeParam[],
    routeIndex: number,
    swapIndex: number,
  ): Flag {
    let flag = Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11

    const isLastSwap =
      swapIndex === priceRoute.bestRoute[routeIndex].swaps.length - 1;

    if (isLastSwap) {
      const isEthDest = isETHAddress(priceRoute.destToken);
      const lastSwap =
        priceRoute.bestRoute[routeIndex].swaps[
          priceRoute.bestRoute[routeIndex].swaps.length - 1
        ];
      const lastSwapExchanges = lastSwap.swapExchanges;
      const anyDexLastSwapNeedUnwrap = lastSwapExchanges
        .map(curSe => {
          let index = 0;
          let swapExchangeIndex = 0;
          priceRoute.bestRoute[routeIndex].swaps.map(curSwap =>
            curSwap.swapExchanges.map(async se => {
              if (Object.is(se, curSe)) {
                index = swapExchangeIndex;
              }
              swapExchangeIndex++;
            }),
          );

          const curExchangeParam = exchangeParams[index];

          return curExchangeParam.needWrapNative;
        })
        .includes(true);

      const noNeedUnwrap = isEthDest && !anyDexLastSwapNeedUnwrap;

      if (noNeedUnwrap || !isEthDest) {
        flag = Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      }
    } else {
      const isEthDest = isETHAddress(swap!.destToken);

      if (isEthDest) {
        if (
          this.anyDexOnSwapDoesntNeedWrapNative(
            priceRoute,
            swap,
            exchangeParams,
          )
        ) {
          flag = Flag.INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP; // 7
        }
      }
    }

    return flag;
  }

  protected buildSingleSwapCallData(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    routeIndex: number,
    swapIndex: number,
    flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag },
    sender: string,
    appendedWrapToSwapMap: { [key: number]: boolean },
    addedWrapToSwapExchangeMap: { [key: string]: boolean },
    maybeWethCallData?: DepositWithdrawReturn,
    swap?: OptimalSwap,
  ): string {
    const isLastSwap =
      swapIndex === priceRoute.bestRoute[routeIndex].swaps.length - 1;
    const isMegaSwap = priceRoute.bestRoute.length > 1;
    const isMultiSwap =
      !isMegaSwap && priceRoute.bestRoute[routeIndex].swaps.length > 1;

    const { swapExchanges } = swap!;

    const applyVerticalBranching = this.doesSwapNeedToApplyVerticalBranching(
      priceRoute,
      routeIndex,
      swap!,
    );

    const anyDexOnSwapDoesntNeedWrapNative =
      this.anyDexOnSwapDoesntNeedWrapNative(priceRoute, swap!, exchangeParams);

    const needToAppendWrapCallData =
      isETHAddress(swap!.destToken) &&
      anyDexOnSwapDoesntNeedWrapNative &&
      !isLastSwap;

    let swapCallData = swapExchanges.reduce(
      (acc, swapExchange, swapExchangeIndex) => {
        return hexConcat([
          acc,
          this.buildSingleSwapExchangeCallData(
            priceRoute,
            routeIndex,
            swapIndex,
            swapExchangeIndex,
            exchangeParams,
            flags,
            addedWrapToSwapExchangeMap,
            !appendedWrapToSwapMap[swapIndex - 1],
            maybeWethCallData,
            swap!.swapExchanges.length > 1,
            applyVerticalBranching,
          ),
        ]);
      },
      '0x',
    );

    if (needToAppendWrapCallData) {
      appendedWrapToSwapMap[swapIndex] = true;
    }

    if (!isMultiSwap && !isMegaSwap) {
      return needToAppendWrapCallData
        ? this.appendWrapEthCallData(swapCallData, maybeWethCallData)
        : swapCallData;
    }

    if (applyVerticalBranching) {
      const vertBranchingCallData = this.buildVerticalBranchingCallData(
        priceRoute,
        routeIndex,
        exchangeParams,
        swap!,
        swapCallData,
        this.buildVerticalBranchingFlag(
          priceRoute,
          swap!,
          exchangeParams,
          routeIndex,
          swapIndex,
        ),
      );

      return needToAppendWrapCallData
        ? this.appendWrapEthCallData(
            vertBranchingCallData,
            maybeWethCallData,
            true,
          )
        : vertBranchingCallData;
    }

    return needToAppendWrapCallData
      ? this.appendWrapEthCallData(swapCallData, maybeWethCallData)
      : swapCallData;
  }

  protected buildSingleRouteCallData(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    route: OptimalRoute,
    routeIndex: number,
    flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag },
    sender: string,
    maybeWethCallData?: DepositWithdrawReturn,
  ): string {
    const isMegaSwap = priceRoute.bestRoute.length > 1;

    const { swaps } = route;

    const appendedWrapToSwapExchangeMap = {};
    const addedWrapToSwapMap = {};
    const callData = swaps.reduce<string>(
      (swapAcc, swap, swapIndex) =>
        hexConcat([
          swapAcc,
          this.buildSingleSwapCallData(
            priceRoute,
            exchangeParams,
            routeIndex,
            swapIndex,
            flags,
            sender,
            appendedWrapToSwapExchangeMap,
            addedWrapToSwapMap,
            maybeWethCallData,
            swap,
          ),
        ]),
      '0x',
    );

    const routeDoesntNeedToAddMultiSwapMetadata =
      route.swaps.length === 1 &&
      route.swaps[0].swapExchanges.length !== 1 &&
      !this.doesSwapNeedToApplyVerticalBranching(
        priceRoute,
        routeIndex,
        route.swaps[0],
      );

    if (isMegaSwap && !routeDoesntNeedToAddMultiSwapMetadata) {
      return this.addMultiSwapMetadata(
        priceRoute,
        exchangeParams,
        callData,
        route.percent,
        route.swaps[0],
        NOT_EXISTING_EXCHANGE_PARAM_INDEX,
        Object.values(addedWrapToSwapMap).includes(true),
      );
    }

    return callData;
  }

  private routeNeedsRootWrapEth(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
  ): boolean {
    const res = priceRoute.bestRoute.every((route, routeIndex) => {
      const firstSwap = route.swaps[0];
      const eachDexOnSwapNeedsWrapNative = this.eachDexOnSwapNeedsWrapNative(
        priceRoute,
        firstSwap,
        exchangeParams,
        routeIndex,
      );

      return eachDexOnSwapNeedsWrapNative;
    });

    return res;
  }

  public getAddress(): string {
    return this.dexHelper.config.data.executorsAddresses![Executors.TWO];
  }

  public buildByteCode(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    sender: string,
    maybeWethCallData?: DepositWithdrawReturn,
  ): string {
    const isMegaSwap = priceRoute.bestRoute.length > 1;
    const isMultiSwap = !isMegaSwap && priceRoute.bestRoute[0].swaps.length > 1;

    const needWrapEth =
      maybeWethCallData?.deposit && isETHAddress(priceRoute.srcToken);
    const needUnwrapEth =
      maybeWethCallData?.withdraw && isETHAddress(priceRoute.destToken);
    const needSendNativeEth = isETHAddress(priceRoute.destToken);
    const routeNeedsRootWrapEth = this.routeNeedsRootWrapEth(
      priceRoute,
      exchangeParams,
    );

    const flags = this.buildFlags(
      priceRoute,
      exchangeParams,
      maybeWethCallData,
    );

    let swapsCalldata = priceRoute.bestRoute.reduce<string>(
      (routeAcc, route, routeIndex) =>
        hexConcat([
          routeAcc,
          this.buildSingleRouteCallData(
            priceRoute,
            exchangeParams,
            route,
            routeIndex,
            flags,
            sender,
            maybeWethCallData,
          ),
        ]),
      '0x',
    );

    if (isMegaSwap && (needWrapEth || needUnwrapEth)) {
      const lastPriceRoute =
        priceRoute.bestRoute[priceRoute.bestRoute.length - 1];
      swapsCalldata = this.buildVerticalBranchingCallData(
        priceRoute,
        priceRoute.bestRoute.length - 1,
        exchangeParams,
        lastPriceRoute.swaps[lastPriceRoute.swaps.length - 1],
        swapsCalldata,
        needWrapEth
          ? Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 0
          : Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP, // 8
      );
    }

    // ETH wrap
    if (needWrapEth && routeNeedsRootWrapEth) {
      let depositCallData = this.buildWrapEthCallData(
        maybeWethCallData.deposit!.calldata,
        Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP, // 9
      );

      if (!(isMegaSwap || isMultiSwap)) {
        const swap = priceRoute.bestRoute[0].swaps[0];
        const percent = exchangeParams.every(ep => ep.needWrapNative)
          ? 100
          : swap.swapExchanges
              .filter((se, index) => {
                return exchangeParams[index].needWrapNative;
              })
              .reduce<number>((acc, se) => {
                acc += se.percent;
                return acc;
              }, 0);

        depositCallData = solidityPack(
          ['bytes16', 'bytes16', 'bytes'],
          [
            hexZeroPad(hexlify(hexDataLength(depositCallData)), 16),
            hexZeroPad(hexlify(100 * percent), 16),
            depositCallData,
          ],
        );
      }

      swapsCalldata = hexConcat([depositCallData, swapsCalldata]);
    }

    // ETH unwrap, only for multiswaps and mega swaps
    if (needUnwrapEth && (isMultiSwap || isMegaSwap)) {
      const withdrawCallData = this.buildUnwrapEthCallData(
        maybeWethCallData.withdraw!.calldata,
      );
      swapsCalldata = hexConcat([swapsCalldata, withdrawCallData]);
    }

    // Special flag (send native) calldata, only for multiswaps and mega swaps
    if (needSendNativeEth && (isMultiSwap || isMegaSwap)) {
      const finalSpecialFlagCalldata = this.buildFinalSpecialFlagCalldata();
      swapsCalldata = hexConcat([swapsCalldata, finalSpecialFlagCalldata]);
    }

    if (((needWrapEth || needUnwrapEth) && isMegaSwap) || isMultiSwap) {
      swapsCalldata = this.addMultiSwapMetadata(
        priceRoute,
        exchangeParams,
        swapsCalldata,
        SWAP_EXCHANGE_100_PERCENTAGE,
        priceRoute.bestRoute[0].swaps[0],
        NOT_EXISTING_EXCHANGE_PARAM_INDEX,
        false,
      );
    }

    return solidityPack(
      ['bytes32', 'bytes', 'bytes'],
      [
        hexZeroPad(hexlify(32), 32), // calldata offset
        hexZeroPad(
          hexlify(hexDataLength(swapsCalldata) + BYTES_64_LENGTH), // calldata length  (64 bytes = bytes12(0) + msg.sender)
          32,
        ),
        swapsCalldata, // calldata
      ],
    );
  }
}
