import { ethers } from 'ethers';
import { DexExchangeParam } from '../types';
import { OptimalRate, OptimalSwap } from '@paraswap/core';
import { isETHAddress } from '../utils';
import { DepositWithdrawReturn } from '../dex/weth/types';
import { Executors, Flag, SpecialDex } from './types';
import {
  BYTES_28_LENGTH,
  BYTES_64_LENGTH,
  DEFAULT_RETURN_AMOUNT_POS,
  EXECUTORS_FUNCTION_CALL_DATA_TYPES,
  ZERO_ROUTE_INDEX,
  ZEROS_28_BYTES,
} from './constants';
import { ExecutorBytecodeBuilder } from './ExecutorBytecodeBuilder';

const {
  utils: { hexlify, hexDataLength, hexConcat, hexZeroPad, solidityPack },
} = ethers;

/**
 * Class to build bytecode for Executor01 - simpleSwap (SINGLE_STEP) with 100% on a path and multiSwap with 100% amounts on each path (HORIZONTAL_SEQUENCE)
 */
export class Executor01BytecodeBuilder extends ExecutorBytecodeBuilder {
  /**
   * Executor01 Flags:
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
   * Executor01 Flags:
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
  // Executor01 doesn't support mega swap routes, flags are built for multi swap routes only here
  protected buildMultiMegaSwapFlags(
    priceRoute: OptimalRate,
    exchangeParam: DexExchangeParam,
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParamIndex: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag } {
    const swap = priceRoute.bestRoute[routeIndex].swaps[swapIndex];
    const { srcToken, destToken } = swap;
    const isFirstSwap = swapIndex === 0;
    const { dexFuncHasRecipient, needWrapNative } = exchangeParam;
    const isEthSrc = isETHAddress(srcToken);
    const isEthDest = isETHAddress(destToken);

    const needWrap = needWrapNative && isEthSrc && maybeWethCallData?.deposit;
    const needUnwrap =
      needWrapNative && isEthDest && maybeWethCallData?.withdraw;

    let dexFlag: Flag;
    let approveFlag: Flag;

    if (isFirstSwap) {
      approveFlag = Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 0
      if (isEthSrc && !needWrap) {
        dexFlag =
          Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 5
      } else if (isEthSrc && needWrap) {
        dexFlag =
          Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 8
      } else if (!isEthSrc && !isEthDest) {
        dexFlag =
          Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 8
      } else if (isEthDest && needUnwrap) {
        dexFlag =
          Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 8
        approveFlag =
          Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 8
      } else if (isEthDest && !needUnwrap) {
        dexFlag = Flag.DONT_INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP; // 4
      } else {
        dexFlag =
          Flag.DONT_INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 8
      }
    } else {
      approveFlag = Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      if (isEthSrc && !needWrap) {
        dexFlag =
          Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP;
      } else if (isEthSrc && needWrap) {
        dexFlag = Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      } else if (dexFuncHasRecipient && !needUnwrap) {
        dexFlag = Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP; // 3
      } else {
        dexFlag = Flag.INSERT_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP; // 11
      }
    }

    return {
      dexFlag,
      approveFlag,
    };
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
  ): string {
    let swapCallData = '';
    const swap = priceRoute.bestRoute[0].swaps[swapIndex];
    const curExchangeParam = exchangeParams[swapIndex];
    const srcAmount = swap.swapExchanges[0].srcAmount;

    const dexCallData = this.buildDexCallData(
      swap,
      curExchangeParam,
      swapIndex,
      flags.dexes[swapIndex],
    );

    swapCallData = hexConcat([dexCallData]);

    if (
      flags.dexes[swapIndex] % 4 !== 1 && // not sendEth
      (!isETHAddress(swap.srcToken) ||
        (isETHAddress(swap.srcToken) && swapIndex !== 0))
    ) {
      const approve = this.erc20Interface.encodeFunctionData('approve', [
        curExchangeParam.targetExchange,
        srcAmount,
      ]);

      const approveCallData = this.buildApproveCallData(
        approve,
        isETHAddress(swap.srcToken) && swapIndex !== 0
          ? this.dexHelper.config.data.wrappedNativeTokenAddress
          : swap.srcToken,
        srcAmount,
        flags.approves[swapIndex],
      );

      swapCallData = hexConcat([approveCallData, swapCallData]);
    }

    if (curExchangeParam.needWrapNative && maybeWethCallData) {
      if (maybeWethCallData.deposit && isETHAddress(swap.srcToken)) {
        const prevExchangeParam = exchangeParams[swapIndex - 1];

        if (
          !prevExchangeParam ||
          (prevExchangeParam && !prevExchangeParam.needWrapNative)
        ) {
          const approveWethCalldata = this.buildApproveCallData(
            this.erc20Interface.encodeFunctionData('approve', [
              curExchangeParam.targetExchange,
              swap.swapExchanges[0].srcAmount,
            ]),
            this.dexHelper.config.data.wrappedNativeTokenAddress,
            srcAmount,
            flags.approves[swapIndex],
          );

          const depositCallData = this.buildWrapEthCallData(
            maybeWethCallData.deposit.calldata,
            Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP, // 9
          );

          swapCallData = hexConcat([
            approveWethCalldata,
            depositCallData,
            swapCallData,
          ]);
        }
      }

      if (maybeWethCallData.withdraw && isETHAddress(priceRoute.destToken)) {
        const nextExchangeParam = exchangeParams[swapIndex + 1];

        if (
          !nextExchangeParam ||
          (nextExchangeParam && !nextExchangeParam.needWrapNative)
        ) {
          const withdrawCallData = this.buildUnwrapEthCallData(
            maybeWethCallData.withdraw.calldata,
          );
          swapCallData = hexConcat([swapCallData, withdrawCallData]);
        }
      }
    }

    return swapCallData;
  }

  protected buildDexCallData(
    swap: OptimalSwap,
    exchangeParam: DexExchangeParam,
    index: number,
    flag: Flag,
  ): string {
    const dontCheckBalanceAfterSwap = flag % 3 === 0;
    const checkDestTokenBalanceAfterSwap = flag % 3 === 2;
    const insertFromAmount = flag % 4 === 3;
    let { exchangeData } = exchangeParam;

    let destTokenPos = 0;
    if (checkDestTokenBalanceAfterSwap && !dontCheckBalanceAfterSwap) {
      const destTokenAddr = isETHAddress(swap.destToken)
        ? this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase()
        : swap.destToken.toLowerCase();

      if (!exchangeParam.dexFuncHasDestToken) {
        exchangeData = hexConcat([exchangeData, ZEROS_28_BYTES, destTokenAddr]);
      }
      const destTokenAddrIndex = exchangeData
        .replace('0x', '')
        .indexOf(destTokenAddr.replace('0x', ''));
      destTokenPos = (destTokenAddrIndex - 24) / 2;
    }

    let fromAmountPos = 0;
    if (insertFromAmount) {
      const fromAmount = ethers.utils.defaultAbiCoder.encode(
        ['uint256'],
        [swap.swapExchanges[0].srcAmount],
      );
      const fromAmountIndex = exchangeData
        .replace('0x', '')
        .indexOf(fromAmount.replace('0x', ''));
      fromAmountPos = fromAmountIndex / 2;
    }

    const { specialDexFlag } = exchangeParam;

    return solidityPack(EXECUTORS_FUNCTION_CALL_DATA_TYPES, [
      exchangeParam.targetExchange, // target exchange
      hexZeroPad(hexlify(hexDataLength(exchangeData) + BYTES_28_LENGTH), 4), // dex calldata length + bytes28(0)
      hexZeroPad(hexlify(fromAmountPos), 2), // fromAmountPos
      hexZeroPad(hexlify(destTokenPos), 2), // destTokenPos
      DEFAULT_RETURN_AMOUNT_POS, // return amount position
      hexZeroPad(hexlify(specialDexFlag || SpecialDex.DEFAULT), 1), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      exchangeData, // dex calldata
    ]);
  }

  public getAddress(): string {
    return this.dexHelper.config.data.executorsAddresses![Executors.ONE];
  }

  public buildByteCode(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    sender: string,
    maybeWethCallData?: DepositWithdrawReturn,
  ): string {
    const flags = this.buildFlags(
      priceRoute,
      exchangeParams,
      maybeWethCallData,
    );

    let swapsCalldata = exchangeParams.reduce<string>(
      (acc, ep, swapIndex) =>
        hexConcat([
          acc,
          this.buildSingleSwapCallData(
            priceRoute,
            exchangeParams,
            ZERO_ROUTE_INDEX,
            swapIndex,
            flags,
            sender,
            {},
            {},
            maybeWethCallData,
          ),
        ]),
      '0x',
    );

    if (
      !exchangeParams[exchangeParams.length - 1].dexFuncHasRecipient &&
      !isETHAddress(priceRoute.destToken)
    ) {
      const transferCallData = this.buildTransferCallData(
        this.erc20Interface.encodeFunctionData('transfer', [
          this.dexHelper.config.data.augustusV6Address,
          priceRoute.destAmount,
        ]),
        priceRoute.destToken,
      );

      swapsCalldata = hexConcat([swapsCalldata, transferCallData]);
    }

    if (
      (maybeWethCallData?.withdraw && isETHAddress(priceRoute.destToken)) ||
      (!exchangeParams[exchangeParams.length - 1].dexFuncHasRecipient &&
        isETHAddress(priceRoute.destToken))
    ) {
      const finalSpecialFlagCalldata = this.buildFinalSpecialFlagCalldata();
      swapsCalldata = hexConcat([swapsCalldata, finalSpecialFlagCalldata]);
    }

    return solidityPack(
      ['bytes32', 'bytes', 'bytes'],
      [
        hexZeroPad(hexlify(32), 32), // calldata offset
        hexZeroPad(
          hexlify(hexDataLength(swapsCalldata) + BYTES_64_LENGTH), // calldata length  (64 bytes = bytes12(0) + msg.sender)
          32,
        ),
        swapsCalldata, // // calldata
      ],
    );
  }
}
