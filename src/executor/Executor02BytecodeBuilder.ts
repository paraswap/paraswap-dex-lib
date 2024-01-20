import { ethers } from 'ethers';
import {
  Address,
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
  BYTES_28_LENGTH,
  BYTES_64_LENGTH,
  EXECUTORS_FUNCTION_CALL_DATA_TYPES,
  SWAP_EXCHANGE_100_PERCENTAGE,
  ZEROS_12_BYTES,
  ZEROS_28_BYTES,
  ZEROS_4_BYTES,
} from './constants';

const {
  utils: { hexlify, hexDataLength, hexConcat, hexZeroPad, solidityPack },
} = ethers;

/**
 * Class to build bytecode for Executor02 - simpleSwap with N DEXs (VERTICAL_BRANCH), multiSwaps (VERTICAL_BRANCH_HORIZONTAL_SEQUENCE) and megaswaps (NESTED_VERTICAL_BRANCH_HORIZONTAL_SEQUENCE)
 */
export class Executor02BytecodeBuilder extends ExecutorBytecodeBuilder {
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

  private getSwapAndSwapExchangeByIndex(
    priceRoute: OptimalRate,
    index: number,
  ): {
    swap: OptimalSwap;
    swapIndex: number;
    swapExchange: OptimalSwapExchange<any>;
    swapExchangeIndex: number;
  } {
    let swap: OptimalSwap | undefined;
    let swapExchange: OptimalSwapExchange<any> | undefined;
    let swapExchangeIndex = 0;
    let resultSwapExchangeIndex = 0;
    let resultSwapIndex = 0;

    priceRoute.bestRoute[0].swaps.map((curSwap, swapIndex) =>
      curSwap.swapExchanges.map(async se => {
        if (index === swapExchangeIndex) {
          swap = curSwap;
          swapExchange = se;
          resultSwapExchangeIndex = swapExchangeIndex;
          resultSwapIndex = swapIndex;
        }
        swapExchangeIndex++;
      }),
    );

    if (!swapExchange) {
      throw new Error(
        `Swap exchange with index ${index} was not found in the provided price route`,
      );
    }

    if (!swap) {
      throw new Error('Swap was not found in the provided price route');
    }

    return {
      swap,
      swapIndex: resultSwapIndex,
      swapExchange,
      swapExchangeIndex: resultSwapExchangeIndex,
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
  protected buildMultiSwapFlags(
    priceRoute: OptimalRate,
    exchangeParam: DexExchangeParam,
    index: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag } {
    const { swap, swapIndex } = this.getSwapAndSwapExchangeByIndex(
      priceRoute,
      index,
    );

    const { srcToken, destToken } = swap;
    const isFirstSwap = swapIndex === 0;
    const { dexFuncHasRecipient, needWrapNative } = exchangeParam;
    const isEthSrc = isETHAddress(srcToken);
    const isEthDest = isETHAddress(destToken);

    const applyVerticalBranching = swap.swapExchanges.length > 1;

    const needWrap = needWrapNative && isEthSrc && maybeWethCallData?.deposit;
    const needUnwrap =
      needWrapNative && isEthDest && maybeWethCallData?.withdraw;

    let dexFlag = Flag.ZERO; // (flag 0 mod 4) = case 0: don't insert fromAmount, (flag 0 mod 3) = case 0: don't check balance after swap
    let approveFlag = Flag.ZERO; // (flag 0 mod 4) = case 0: don't insert fromAmount, (flag 0 mod 3) = case 0: don't check balance after swap

    if (isFirstSwap) {
      if (applyVerticalBranching) {
        // keep default
      } else if (isEthSrc && !needWrap) {
        dexFlag = Flag.FIVE; // (flag 5 mod 4) = case 1: sendEth equal to fromAmount, (flag 5 mod 3) = case 2: check "srcToken" balance after swap
      } else if (isEthSrc && needWrap) {
        dexFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
      } else if (!isEthSrc && !isEthDest) {
        dexFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
      } else if (isEthDest && needUnwrap) {
        dexFlag = Flag.EIGHT; // (flag 8 mod 4) = case 0: don't insert fromAmount, (flag 8 mod 3) = case 2: check "srcToken" balance after swap
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
      } else if (needUnwrap) {
        dexFlag = Flag.FIFTEEN; // (flag 11 mod 4) = case 3: insert fromAmount, (flag 11 mod 3) = case 2: check "srcToken" balance after swap
        approveFlag = Flag.FIFTEEN; // (flag 15 mod 4) = case 3: insert fromAmount, (flag 15 mod 3) = case 0: don't check balance after swap
      } else {
        dexFlag = Flag.FIFTEEN; // (flag 11 mod 4) = case 3: insert fromAmount, (flag 11 mod 3) = case 2: check "srcToken" balance after swap
        approveFlag = Flag.ELEVEN; // (flag 11 mod 4) = case 3: insert fromAmount, (flag 11 mod 3) = case 2: check "srcToken" balance after swap
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
    flag: Flag,
    swapExchange: OptimalSwapExchange<any>,
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
        [swapExchange!.srcAmount],
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
      hexZeroPad(hexlify(specialDexFlag || SpecialDex.DEFAULT), 2), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      exchangeData, // dex calldata
    ]);
  }

  private addMultiSwapMetadata(callData: string, percentage: number) {
    return solidityPack(
      ['bytes16', 'bytes16', 'bytes'],
      [
        hexZeroPad(hexlify(hexDataLength(callData)), 16),
        hexZeroPad(hexlify(Math.ceil(percentage * 100)), 16),
        callData,
      ],
    );
  }

  private buildVerticalBranchingCallData(
    swap: OptimalSwap,
    swapCallData: string,
    sender: Address,
    flag: Flag,
  ) {
    const value = 0; // this value doesn't matter since it will be replaced during execution
    const executor02Address = this.getAddress();

    const calldata = solidityPack(
      ['bytes', 'bytes32', 'bytes12', 'bytes20'],
      [swapCallData, hexZeroPad(hexlify(value), 32), ZEROS_12_BYTES, sender],
    );

    const data = solidityPack(
      ['bytes28', 'bytes4', 'bytes32', 'bytes32', 'bytes'],
      [
        ZEROS_28_BYTES, // empty bytes28
        ZEROS_4_BYTES, // fallback selector
        hexZeroPad(hexlify(32), 32), // calldata offset
        hexZeroPad(hexlify(hexDataLength(calldata)), 32), // calldata length
        calldata, // calldata
      ],
    );

    const destTokenAddr = isETHAddress(swap.destToken)
      ? this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase()
      : swap.destToken.toLowerCase();

    const destTokenAddrIndex = data
      .replace('0x', '')
      .indexOf(destTokenAddr.replace('0x', ''));
    const destTokenPos = destTokenAddrIndex / 2 - 40;

    const fromAmountPos = hexDataLength(data) - 64 - 28; // 64 (position), 28 (selector padding);

    return solidityPack(
      ['bytes20', 'bytes4', 'bytes2', 'bytes2', 'bytes4', 'bytes'],
      [
        executor02Address, // target exchange
        hexZeroPad(hexlify(hexDataLength(data)), 4), // dex calldata length
        hexZeroPad(hexlify(fromAmountPos), 2), // fromAmountPos
        hexZeroPad(hexlify(destTokenPos), 2), // destTokenPos
        hexZeroPad(hexlify(flag), 4), // flag
        data, // dexes calldata
      ],
    );
  }

  private buildSingleSwapExchangeCallData(
    priceRoute: OptimalRate,
    swap: OptimalSwap,
    swapExchange: OptimalSwapExchange<any>,
    exchangeParams: DexExchangeParam[],
    flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag },
    maybeWethCallData?: DepositWithdrawReturn,
    addMultiSwapMetadata?: boolean,
    applyVerticalBranching?: boolean,
  ): string {
    let swapExchangeCallData = '';
    const srcAmount = swapExchange.srcAmount;

    let index = 0;
    let swapIndex = 0;
    let swapIndexTemp = 0;
    let swapExchangeIndex = 0;
    priceRoute.bestRoute[0].swaps.map(curSwap => {
      if (Object.is(curSwap, swap)) {
        swapIndex = swapExchangeIndex;
      }
      swapIndexTemp++;

      curSwap.swapExchanges.map(async se => {
        if (Object.is(se, swapExchange)) {
          index = swapExchangeIndex;
        }
        swapExchangeIndex++;
      });
    });

    const curExchangeParam = exchangeParams[index];

    const dexCallData = this.buildDexCallData(
      swap,
      curExchangeParam,
      index,
      flags.dexes[index],
      swapExchange,
    );

    swapExchangeCallData = hexConcat([dexCallData]);
    const isLastSwap = swapIndex === priceRoute.bestRoute[0].swaps.length - 1;
    const isLast = index === exchangeParams.length - 1;

    if (!isETHAddress(swap!.srcToken)) {
      const approve = this.erc20Interface.encodeFunctionData('approve', [
        curExchangeParam.targetExchange,
        srcAmount,
      ]);

      const approveCallData = this.buildApproveCallData(
        approve,
        isETHAddress(swap!.srcToken) && index !== 0
          ? this.dexHelper.config.data.wrappedNativeTokenAddress
          : swap!.srcToken,
        srcAmount,
        flags.approves[index],
      );

      swapExchangeCallData = hexConcat([approveCallData, swapExchangeCallData]);
    }

    if (curExchangeParam.needWrapNative && maybeWethCallData) {
      if (maybeWethCallData.deposit && isETHAddress(swap!.srcToken)) {
        const approveWethCalldata = this.buildApproveCallData(
          this.erc20Interface.encodeFunctionData('approve', [
            curExchangeParam.targetExchange,
            srcAmount,
          ]),
          this.dexHelper.config.data.wrappedNativeTokenAddress,
          srcAmount,
          flags.approves[index],
        );

        swapExchangeCallData = hexConcat([
          approveWethCalldata,
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

        if ((isLast && eachSwapNeedWrapNative) || !eachSwapNeedWrapNative) {
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
      !exchangeParams[index].dexFuncHasRecipient &&
      !isETHAddress(swap.destToken)
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
      (!applyVerticalBranching && isLast && isETHAddress(swap.destToken)) ||
      (!exchangeParams[index].dexFuncHasRecipient &&
        isETHAddress(swap.destToken))
    ) {
      const finalSpecialFlagCalldata = this.buildFinalSpecialFlagCalldata();
      swapExchangeCallData = hexConcat([
        swapExchangeCallData,
        finalSpecialFlagCalldata,
      ]);
    }

    if (addMultiSwapMetadata) {
      return this.addMultiSwapMetadata(
        swapExchangeCallData,
        swapExchange.percent,
      );
    }

    return swapExchangeCallData;
  }

  protected buildSingleSwapCallData(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    swapIndex: number,
    flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag },
    sender: string,
    maybeWethCallData?: DepositWithdrawReturn,
    swap?: OptimalSwap,
  ): string {
    const isMultiSwap = priceRoute.bestRoute[0].swaps.length > 1;
    const { swapExchanges } = swap!;

    const applyVerticalBranching =
      isMultiSwap && swap!.swapExchanges.length > 1;

    const swapCallData = swapExchanges.reduce((acc, swapExchange) => {
      return hexConcat([
        acc,
        this.buildSingleSwapExchangeCallData(
          priceRoute,
          swap!,
          swapExchange,
          exchangeParams,
          flags,
          maybeWethCallData,
          swap!.swapExchanges.length > 1,
          applyVerticalBranching,
        ),
      ]);
    }, '0x');

    if (!isMultiSwap) {
      return swapCallData;
    }

    if (applyVerticalBranching) {
      let flag = Flag.ELEVEN; // (flag 11 mod 4) = case 3: insert fromAmount, (flag 11 mod 3) = case 2: check "srcToken" balance after swap

      const isLastSwap = swapIndex === priceRoute.bestRoute[0].swaps.length - 1;

      if (isLastSwap) {
        const isEthDest = isETHAddress(priceRoute.destToken);
        const lastSwap =
          priceRoute.bestRoute[0].swaps[
            priceRoute.bestRoute[0].swaps.length - 1
          ];
        const lastSwapExchanges = lastSwap.swapExchanges;
        const anyDexLastSwapNeedUnwrap = lastSwapExchanges
          .map(curSe => {
            let index = 0;
            let swapExchangeIndex = 0;
            priceRoute.bestRoute[0].swaps.map(curSwap =>
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

        const noNeedUnwrap =
          (isEthDest && !anyDexLastSwapNeedUnwrap) || !isEthDest;

        if (noNeedUnwrap) {
          flag = Flag.FIFTEEN; // (flag 15 mod 4) = case 3: insert fromAmount, (flag 15 mod 3) = case 0: don't check balance after swap
        }
      }

      return this.buildVerticalBranchingCallData(
        swap!,
        swapCallData,
        sender,
        flag,
      );
    }

    return swapCallData;
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
    const isMultiSwap = priceRoute.bestRoute[0].swaps.length > 1;
    const needWrapEth =
      maybeWethCallData?.deposit && isETHAddress(priceRoute.srcToken);
    const needUnwrapEth =
      maybeWethCallData?.withdraw && isETHAddress(priceRoute.destToken);
    const needSendNativeEth = isETHAddress(priceRoute.destToken);

    const flags = this.buildFlags(
      priceRoute,
      exchangeParams,
      maybeWethCallData,
    );

    let swapsCalldata = priceRoute.bestRoute[0].swaps.reduce<string>(
      (acc, swap, index) =>
        hexConcat([
          acc,
          this.buildSingleSwapCallData(
            priceRoute,
            exchangeParams,
            index,
            flags,
            sender,
            maybeWethCallData,
            swap,
          ),
        ]),
      '0x',
    );

    if (needWrapEth && isMultiSwap) {
      swapsCalldata = this.addMultiSwapMetadata(
        swapsCalldata,
        SWAP_EXCHANGE_100_PERCENTAGE,
      );
    }

    // ETH wrap
    if (needWrapEth) {
      const depositCallData = this.buildWrapEthCallData(
        maybeWethCallData.deposit!.calldata,
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

    // ETH unwrap, only for multiswaps
    if (needUnwrapEth && isMultiSwap) {
      const withdrawCallData = this.buildUnwrapEthCallData(
        maybeWethCallData.withdraw!.calldata,
      );
      swapsCalldata = hexConcat([swapsCalldata, withdrawCallData]);
    }

    // Special flag (send native) calldata, only for multiswaps
    if (needSendNativeEth && isMultiSwap) {
      const finalSpecialFlagCalldata = this.buildFinalSpecialFlagCalldata();
      swapsCalldata = hexConcat([swapsCalldata, finalSpecialFlagCalldata]);
    }

    if (!needWrapEth && isMultiSwap) {
      swapsCalldata = this.addMultiSwapMetadata(
        swapsCalldata,
        SWAP_EXCHANGE_100_PERCENTAGE,
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
