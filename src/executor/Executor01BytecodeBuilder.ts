import { ethers } from 'ethers';
import { DexExchangeParam } from '../types';
import { OptimalRate, OptimalSwap } from '@paraswap/core';
import { isETHAddress } from '../utils';
import { DepositWithdrawReturn } from '../dex/weth/types';
import { Executors, Flag, SpecialDex } from './types';
import {
  BYTES_28_LENGTH,
  BYTES_64_LENGTH,
  EXECUTORS_FUNCTION_CALL_DATA_TYPES,
  EXECUTORS_FUNCTION_CALL_DATA_TYPES_WITH_PREPEND,
  ZEROS_12_BYTES,
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
    index: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag } {
    const { srcToken, destToken } = priceRoute.bestRoute[0].swaps[index];
    const isEthSrc = isETHAddress(srcToken);
    const isEthDest = isETHAddress(destToken);

    const { dexFuncHasRecipient, needWrapNative } = exchangeParam;

    const needWrap = needWrapNative && isEthSrc && maybeWethCallData?.deposit;
    const needUnwrap =
      needWrapNative && isEthDest && maybeWethCallData?.withdraw;

    let dexFlag = Flag.ZERO; // (flag 0 mod 4) = case 0: don't insert fromAmount, (flag 0 mod 3) = case 0: don't check balance after swap
    let approveFlag = Flag.ZERO; // (flag 0 mod 4) = case 0: don't insert fromAmount, (flag 0 mod 3) = case 0: don't check balance after swap

    if (isEthSrc && !needWrap) {
      dexFlag = Flag.FIVE; // (flag 5 mod 4) = case 1: sendEth equal to fromAmount, (flag 5 mod 3) = case 2: check "srcToken" balance after swap
    } else if (isEthDest && !needUnwrap) {
      dexFlag = Flag.FOUR; // (flag 4 mod 4) = case 0: don't insert fromAmount, (flag 4 mod 3) = case 1: check eth balance after swap
    } else if (!dexFuncHasRecipient || (isEthDest && needUnwrap)) {
      dexFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
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
  protected buildMultiSwapFlags(
    priceRoute: OptimalRate,
    exchangeParam: DexExchangeParam,
    index: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag } {
    const swap = priceRoute.bestRoute[0].swaps[index];
    const { srcToken, destToken } = swap;
    const isFirstSwap = index === 0;
    const { dexFuncHasRecipient, needWrapNative } = exchangeParam;
    const isEthSrc = isETHAddress(srcToken);
    const isEthDest = isETHAddress(destToken);

    const needWrap = needWrapNative && isEthSrc && maybeWethCallData?.deposit;
    const needUnwrap =
      needWrapNative && isEthDest && maybeWethCallData?.withdraw;

    let dexFlag: Flag;
    let approveFlag: Flag;

    if (isFirstSwap) {
      approveFlag = Flag.ZERO; // (flag 0 mod 4) = case 0: don't insert fromAmount, (flag 0 mod 3) = case 0: don't check balance after swap
      if (isEthSrc && !needWrap) {
        dexFlag = Flag.FIVE; // (flag 5 mod 4) = case 1: sendEth equal to fromAmount, (flag 5 mod 3) = case 2: check "srcToken" balance after swap
      } else if (isEthSrc && needWrap) {
        dexFlag = Flag.EIGHT; // (flag 0 mod 4) = case 0: don't insert fromAmount, (flag 0 mod 3) = case 0: don't check balance after swap
      } else if (!isEthSrc && !isEthDest) {
        dexFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
      } else if (isEthDest && needUnwrap) {
        dexFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
        approveFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
      } else if (isEthDest && !needUnwrap) {
        dexFlag = Flag.FOUR; // (flag 4 mod 4) = case 0: don't insert fromAmount, (flag 4 mod 3) = case 1: check eth balance after swap
      } else {
        dexFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
      }
    } else {
      approveFlag = Flag.THREE; // (flag 3 mod 4) = case 3: insert fromAmount, (flag 3 mod 3) = case 0: don't check balance after swap
      if (isEthSrc && !needWrap) {
        dexFlag = Flag.FIVE; // (flag 5 mod 4) = case 1: sendEth equal to fromAmount, (flag 5 mod 3) = case 2: check "srcToken" balance after swap
      } else if (isEthSrc && needWrap) {
        dexFlag = Flag.FIFTEEN; // (flag 15 mod 4) = case 3: insert fromAmount, (flag 15 mod 3) = case 0: don't check balance after swap
      } else if (dexFuncHasRecipient && !needUnwrap) {
        dexFlag = Flag.FIFTEEN; // (flag 15 mod 4) = case 3: insert fromAmount, (flag 15 mod 3) = case 0: don't check balance after swap
      } else {
        dexFlag = Flag.ELEVEN; // (flag 11 mod 4) = case 3: insert fromAmount, (flag 11 mod 3) = case 2: check "srcToken" balance after swap
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
    index: number,
    flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag },
    sender: string,
    maybeWethCallData?: DepositWithdrawReturn,
  ): string {
    let swapCallData = '';
    const swap = priceRoute.bestRoute[0].swaps[index];
    const curExchangeParam = exchangeParams[index];
    const srcAmount = swap.swapExchanges[0].srcAmount;

    const dexCallData = this.buildDexCallData(
      swap,
      curExchangeParam,
      index,
      index === priceRoute.bestRoute[0].swaps.length - 1,
      flags.dexes[index],
    );

    swapCallData = hexConcat([dexCallData]);

    const skipApprove = !!curExchangeParam.skipApprove;

    if (
      flags.dexes[index] % 4 !== 1 && // not sendEth
      (!isETHAddress(swap.srcToken) ||
        (isETHAddress(swap.srcToken) && index !== 0)) &&
      !skipApprove
    ) {
      const approve = this.erc20Interface.encodeFunctionData('approve', [
        curExchangeParam.targetExchange,
        srcAmount,
      ]);

      const approveCallData = this.buildApproveCallData(
        approve,
        isETHAddress(swap.srcToken) && index !== 0
          ? this.dexHelper.config.data.wrappedNativeTokenAddress
          : swap.srcToken,
        srcAmount,
        flags.approves[index],
      );

      swapCallData = hexConcat([approveCallData, swapCallData]);
    }

    if (curExchangeParam.needWrapNative && maybeWethCallData) {
      if (maybeWethCallData.deposit && isETHAddress(swap.srcToken)) {
        const prevExchangeParam = exchangeParams[index - 1];

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
            flags.approves[index],
          );

          const depositCallData = this.buildWrapEthCallData(
            maybeWethCallData.deposit.calldata,
            Flag.NINE,
          );

          swapCallData = hexConcat([
            approveWethCalldata,
            depositCallData,
            swapCallData,
          ]);
        }
      }

      if (maybeWethCallData.withdraw && isETHAddress(priceRoute.destToken)) {
        const nextExchangeParam = exchangeParams[index + 1];

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
    isLastSwap: boolean,
    flag: Flag,
  ): string {
    const dontCheckBalanceAfterSwap = flag % 3 === 0;
    const checkDestTokenBalanceAfterSwap = flag % 3 === 2;
    const insertFromAmount = flag % 4 === 3;
    let {
      exchangeData,
      specialDexFlag,
      transferSrcTokenBeforeSwap,
      targetExchange,
    } = exchangeParam;

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

    let data = [];
    let calldataTypes = EXECUTORS_FUNCTION_CALL_DATA_TYPES;

    if (transferSrcTokenBeforeSwap) {
      const transferCallData = this.buildTransferCallData(
        this.erc20Interface.encodeFunctionData('transfer', [
          transferSrcTokenBeforeSwap,
          swap.swapExchanges[index].srcAmount,
        ]),
        isETHAddress(swap.srcToken)
          ? this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase()
          : swap.srcToken.toLowerCase(),
      );
      data.push(transferCallData);
      calldataTypes = EXECUTORS_FUNCTION_CALL_DATA_TYPES_WITH_PREPEND;
    }

    data = data.concat([
      targetExchange,
      hexZeroPad(hexlify(hexDataLength(exchangeData) + BYTES_28_LENGTH), 4), // dex calldata length + bytes28(0)
      hexZeroPad(hexlify(fromAmountPos), 2), // fromAmountPos
      hexZeroPad(hexlify(destTokenPos), 2), // destTokenPos
      hexZeroPad(hexlify('0xff'), 1), // TODO: Fix returnAmount Pos
      hexZeroPad(hexlify(specialDexFlag || SpecialDex.DEFAULT), 1), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      exchangeData, // dex calldata
    ]);

    return solidityPack(calldataTypes, data);
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
      (acc, ep, index) =>
        hexConcat([
          acc,
          this.buildSingleSwapCallData(
            priceRoute,
            exchangeParams,
            index,
            flags,
            sender,
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
