import { ethers } from 'ethers';
import { OptimalRate } from '@paraswap/core';
import { DexExchangeParam } from '../types';
import { Flag } from './types';
import { isETHAddress } from '../utils';
import { DepositWithdrawReturn } from '../dex/weth/types';
import { ExecutorBytecodeBuilder } from './ExecutorBytecodeBuilder';
import { BYTES_64_LENGTH } from './constants';

const {
  utils: { hexlify, hexDataLength, hexConcat, hexZeroPad, solidityPack },
} = ethers;

/**
 * Class to build bytecode for Executor02 - simpleSwap with N DEXs (VERTICAL_BRANCH) and megaswap (VERTICAL_BRANCH_HORIZONTAL_SEQUENCE, NESTED_VERTICAL_BRANCH_HORIZONTAL_SEQUENCE)
 */
export class Executor02BytecodeBuilder extends ExecutorBytecodeBuilder {
  protected buildSimpleSwapFlags(
    priceRoute: OptimalRate,
    exchangeParam: DexExchangeParam,
    index: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag } {
    const { srcToken, destToken } = priceRoute.bestRoute[0].swaps[0];
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
   * case 2: check desTtoken balance after swap
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

    let dexFlag = Flag.ZERO; // (flag 0 mod 4) = case 0: don't insert fromAmount, (flag 0 mod 3) = case 0: don't check balance after swap
    let approveFlag = Flag.ZERO; // (flag 0 mod 4) = case 0: don't insert fromAmount, (flag 0 mod 3) = case 0: don't check balance after swap

    if (isFirstSwap) {
      if (isEthSrc && !needWrap) {
        dexFlag = Flag.FIVE; // (flag 5 mod 4) = case 1: sendEth equal to fromAmount, (flag 5 mod 3) = case 2: check "srcToken" balance after swap
      } else if (isEthSrc && needWrap) {
        dexFlag = Flag.ZERO; // (flag 0 mod 4) = case 0: don't insert fromAmount, (flag 0 mod 3) = case 0: don't check balance after swap
        approveFlag = Flag.ZERO;
      } else if (!isEthSrc && !isEthDest) {
        dexFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
      } else if (isEthDest && needUnwrap) {
        dexFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
        approveFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
      } else if (isEthDest && !needUnwrap) {
        dexFlag = Flag.FOUR; // (flag 4 mod 4) = case 0: don't insert fromAmount, (flag 4 mod 3) = case 1: check eth balance after swap
      } else if (!dexFuncHasRecipient) {
        dexFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
      }
    } else {
      if (isEthSrc && !needWrap) {
        dexFlag = Flag.FIVE; // (flag 5 mod 4) = case 1: sendEth equal to fromAmount, (flag 5 mod 3) = case 2: check "srcToken" balance after swap
      } else if (isEthSrc && needWrap) {
        dexFlag = Flag.FIFTEEN; // (flag 15 mod 4) = case 3: insert fromAmount, (flag 15 mod 3) = case 0: don't check balance after swap
        approveFlag = Flag.FIFTEEN; // (flag 15 mod 4) = case 3: insert fromAmount, (flag 15 mod 3) = case 0: don't check balance after swap
      } else {
        dexFlag = Flag.ELEVEN; // (flag 11 mod 4) = case 3: insert fromAmount, (flag 11 mod 3) = case 2: check "srcToken" balance after swap
        approveFlag = Flag.ELEVEN; // (flag 11 mod 4) = case 3: insert fromAmount, (flag 11 mod 3) = case 2: check "srcToken" balance after swap
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
    maybeWethCallData?: DepositWithdrawReturn,
  ): string {
    let swapCallData = '';
    const swap = priceRoute.bestRoute[0].swaps[0];
    const curExchangeParam = exchangeParams[index];
    const srcAmount = swap.swapExchanges[index].srcAmount;
    const swapExchange = swap.swapExchanges[index];

    const dexCallData = this.buildDexCallData(
      swap,
      curExchangeParam,
      index,
      flags.dexes[index],
    );

    swapCallData = hexConcat([dexCallData]);
    const isLast = index === exchangeParams.length - 1;

    if (!isETHAddress(swap.srcToken)) {
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
        const approveWethCalldata = this.buildApproveCallData(
          this.erc20Interface.encodeFunctionData('approve', [
            curExchangeParam.targetExchange,
            srcAmount,
          ]),
          this.dexHelper.config.data.wrappedNativeTokenAddress,
          srcAmount,
          flags.approves[index],
        );

        swapCallData = hexConcat([approveWethCalldata, swapCallData]);
      }

      if (maybeWethCallData.withdraw && isETHAddress(priceRoute.destToken)) {
        let withdrawCallData = '0x';
        const eachSwapNeedWrapNative = exchangeParams.every(
          ep => ep.needWrapNative,
        );
        if ((isLast && eachSwapNeedWrapNative) || !eachSwapNeedWrapNative) {
          withdrawCallData = this.buildUnwrapEthCallData(
            maybeWethCallData.withdraw.calldata,
          );
        }

        swapCallData = hexConcat([swapCallData, withdrawCallData]);
      }
    }

    if (
      // isLast &&
      !exchangeParams[index].dexFuncHasRecipient &&
      !isETHAddress(priceRoute.destToken)
    ) {
      const transferCallData = this.buildTransferCallData(
        this.erc20Interface.encodeFunctionData('transfer', [
          this.dexHelper.config.data.augustusV6Address,
          priceRoute.destAmount,
        ]),
        priceRoute.destToken,
      );

      swapCallData = hexConcat([swapCallData, transferCallData]);
    }

    if (
      (isLast && isETHAddress(priceRoute.destToken)) ||
      (!exchangeParams[index].dexFuncHasRecipient &&
        isETHAddress(priceRoute.destToken))
    ) {
      const finalSpecialFlagCalldata = this.buildFinalSpecialFlagCalldata();
      swapCallData = hexConcat([swapCallData, finalSpecialFlagCalldata]);
    }

    return solidityPack(
      ['bytes16', 'bytes16', 'bytes'],
      [
        hexZeroPad(hexlify(hexDataLength(swapCallData)), 16),
        hexZeroPad(hexlify(swapExchange.percent * 100), 16),
        swapCallData,
      ],
    );
  }

  public buildByteCode(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
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
            maybeWethCallData,
          ),
        ]),
      '0x',
    );

    if (maybeWethCallData?.deposit && isETHAddress(priceRoute.srcToken)) {
      const depositCallData = this.buildWrapEthCallData(
        maybeWethCallData.deposit.calldata,
        Flag.NINE,
      );

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

      const depositSwapCallData = solidityPack(
        ['bytes16', 'bytes16', 'bytes'],
        [
          hexZeroPad(hexlify(hexDataLength(depositCallData)), 16),
          hexZeroPad(hexlify(100 * percent), 16),
          depositCallData,
        ],
      );

      swapsCalldata = hexConcat([depositSwapCallData, swapsCalldata]);
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
