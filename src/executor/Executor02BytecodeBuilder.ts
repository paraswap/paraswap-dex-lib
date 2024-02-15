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

    const { dexFuncHasRecipient, needWrapNative, specialDexFlag } =
      exchangeParam;

    const isSpecialDex =
      specialDexFlag !== undefined && specialDexFlag !== SpecialDex.DEFAULT;

    const needWrap = needWrapNative && isEthSrc && maybeWethCallData?.deposit;
    const needUnwrap =
      needWrapNative && isEthDest && maybeWethCallData?.withdraw;

    let dexFlag = Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
    let approveFlag =
      Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 0

    if (isFirstSwap) {
      if (
        (applyVerticalBranching && !isSpecialDex) ||
        (isSpecialDex && needWrapNative)
      ) {
        // keep default flags
      } else if (isEthSrc && !needWrap) {
        dexFlag =
          isHorizontalSequence && !applyVerticalBranching
            ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 5
            : dexFuncHasRecipient
            ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 9
            : Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 5
      } else if (
        (isEthSrc && needWrap) ||
        (!isEthSrc && !isEthDest) ||
        (isEthDest && needUnwrap)
      ) {
        dexFlag =
          isHorizontalSequence && !applyVerticalBranching && !isSpecialDex
            ? Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 11
            : Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11
      } else if (isEthDest && !needUnwrap) {
        dexFlag =
          isHorizontalSequence && !applyVerticalBranching
            ? Flag.INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP // 7
            : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      } else if (isEthDest && needUnwrap) {
        dexFlag = Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11
      } else if (!dexFuncHasRecipient) {
        dexFlag = Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11
      }
    } else {
      if (isSpecialDex && !isLastSwap) {
        // keep default flags
      } else if (isEthSrc && !needWrap && !isSpecialDex) {
        dexFlag =
          isHorizontalSequence && !isLastSwap
            ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 5
            : Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 9
      } else if (isEthSrc && needWrap && !isSpecialDex) {
        dexFlag = Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      } else if (needUnwrap && !isSpecialDex) {
        dexFlag =
          isHorizontalSequence && !isLastSwap
            ? Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP // 11
            : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      } else if (isSpecialDex) {
        if (isEthDest && !needUnwrap) {
          dexFlag =
            isHorizontalSequence && !isLastSwap && !applyVerticalBranching
              ? Flag.INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP // 7
              : Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
        } else if (isEthSrc && !needWrap) {
          dexFlag =
            Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 5
        } else {
          dexFlag =
            isHorizontalSequence && !isLastSwap && !applyVerticalBranching
              ? Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 3
              : Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11
        }
      } else if (!dexFuncHasRecipient) {
        dexFlag = Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11
      } else {
        dexFlag = Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      }
    }

    return {
      dexFlag,
      approveFlag,
    };
  }

  protected buildDexCallData(
    swap: OptimalSwap,
    exchangeParam: DexExchangeParam,
    index: number,
    isLastSwap: boolean,
    flag: Flag,
    swapExchange: OptimalSwapExchange<any>,
  ): string {
    const dontCheckBalanceAfterSwap = flag % 3 === 0;
    const checkDestTokenBalanceAfterSwap = flag % 3 === 2;
    const insertFromAmount = flag % 4 === 3;
    let { exchangeData, specialDexFlag, targetExchange } = exchangeParam;

    let destTokenPos = 0;
    if (checkDestTokenBalanceAfterSwap && !dontCheckBalanceAfterSwap) {
      const destTokenAddr = isETHAddress(swap.destToken)
        ? this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase()
        : swap.destToken.toLowerCase();

      exchangeData = this.addTokenAddressToCallData(
        exchangeData,
        destTokenAddr,
      );
      const destTokenAddrIndex = exchangeData
        .replace('0x', '')
        .indexOf(destTokenAddr.replace('0x', ''));
      destTokenPos = (destTokenAddrIndex - 24) / 2;
    }

    let fromAmountPos = 0;
    if (insertFromAmount) {
      const fromAmount = ethers.utils.defaultAbiCoder.encode(
        ['uint256'],
        [swapExchange!.srcAmount],
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
    exchangeParamIndex?: number,
    wrapWasAddedInSwapExchange?: boolean,
  ) {
    let srcTokenAddress = swap.srcToken;

    let doesAnyDexOnSwapNeedsWrapNative: boolean;
    if (exchangeParamIndex) {
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
        hexZeroPad(hexlify(Math.ceil(percentage * 100)), 8), // percentage
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
            ? this.dexHelper.config.data.wrappedNativeTokenAddress
            : destTokenAddrLowered
          ).replace('0x', ''),
        );

      destTokenPos = destTokenAddrIndex / 2 - 40;
    }

    const fromAmountPos = hexDataLength(data) - 64 - 28; // 64 (position), 28 (selector padding);

    return this.packVerticalBranchingCallData(
      data,
      fromAmountPos,
      destTokenPos,
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
    addedWrapToSwapMap: { [key: string]: boolean },
    allowToAddWrap = true,
    maybeWethCallData?: DepositWithdrawReturn,
    addMultiSwapMetadata?: boolean,
    applyVerticalBranching?: boolean,
  ): string {
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
      swap,
      curExchangeParam,
      exchangeParamIndex,
      false,
      flags.dexes[exchangeParamIndex],
      swapExchange,
    );

    swapExchangeCallData = hexConcat([dexCallData]);
    const skipApprove = !!curExchangeParam.skipApprove;

    const isLastSwap =
      swapIndex === priceRoute.bestRoute[routeIndex].swaps.length - 1;
    const isLast = exchangeParamIndex === exchangeParams.length - 1;

    if (
      (!isETHAddress(swap!.srcToken) && !skipApprove) ||
      curExchangeParam.spender // always do approve if spender is set
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
          curExchangeParam.targetExchange,
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
          !addedWrapToSwapMap[`${routeIndex}_${swapIndex}`] &&
          !skipWrap
        ) {
          depositCallData = this.buildWrapEthCallData(
            maybeWethCallData.deposit.calldata,
            Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP, // 9
          );
          addedWrapToSwapMap[`${routeIndex}_${swapIndex}`] = true;
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
        const eachSwapNeedWrapNative = exchangeParams.every(
          ep => ep.needWrapNative,
        );

        if (!isLast && !eachSwapNeedWrapNative) {
          withdrawCallData = this.buildUnwrapEthCallData(
            maybeWethCallData.withdraw.calldata,
          );
        }

        swapExchangeCallData = hexConcat([
          swapExchangeCallData,
          withdrawCallData,
        ]);
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
      let percent: number;
      if (!applyVerticalBranching && swap.swapExchanges.length > 1) {
        const route = priceRoute.bestRoute[routeIndex];
        const { percent: routePercent } = route;
        const { percent: swapExchangePercent } = swapExchange;
        percent = (routePercent / 100) * swapExchangePercent;
      } else {
        percent = swapExchange.percent;
      }

      return this.addMultiSwapMetadata(
        priceRoute,
        exchangeParams,
        swapExchangeCallData,
        percent,
        swap,
        exchangeParamIndex,
        addedWrapToSwapMap[`${routeIndex}_${swapIndex}`],
      );
    }

    return swapExchangeCallData;
  }

  private appendWrapEthCallData(
    calldata: string,
    maybeWethCallData?: DepositWithdrawReturn,
  ) {
    if (maybeWethCallData?.deposit) {
      const depositCallData = this.buildWrapEthCallData(
        maybeWethCallData.deposit.calldata,
        Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP, // 9
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

    return (
      (isMultiSwap || isMegaSwap) &&
      swap.swapExchanges.length > 1 &&
      (swap.srcToken !== priceRoute.srcToken ||
        swap.destToken !== priceRoute.destToken)
    );
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
    addedWrapToSwapMap: { [key: string]: boolean },
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
            addedWrapToSwapMap,
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
        ? this.appendWrapEthCallData(vertBranchingCallData, maybeWethCallData)
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

    const appendedWrapToSwapMap = {};
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
            appendedWrapToSwapMap,
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
        0,
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
