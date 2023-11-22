import { ethers } from 'ethers';
import { IDexHelper } from '../dex-helper';
import { DexExchangeParam } from '../types';
import { Address, OptimalRate, OptimalSwap } from '@paraswap/core';
import { isETHAddress } from '../utils';
import { DepositWithdrawReturn } from '../dex/weth/types';
import ERC20ABI from '../abi/erc20.json';
import { Interface } from '@ethersproject/abi';
import { IExecutorBytecodeBuilder } from './IExecutorBytecodeBuilder';

const {
  utils: { hexlify, hexDataLength, hexConcat, hexZeroPad, solidityPack },
} = ethers;

const EXECUTOR_01_FUNCTION_CALL_DATA_TYPES: string[] = [
  'bytes20', // address(bytes20)
  'bytes4', // calldata Size(bytes 4)
  'bytes2', // fromAmount Pos(bytes2)
  'bytes2', // destTokenPos(bytes2)
  'bytes2', // specialExchange (bytes2)
  'bytes2', // flag(bytes2)
  'bytes28', // zero padding (bytes28)
  'bytes', // dex calldata (bytes)
];

const APPROVE_CALLDATA_DEST_TOKEN_POS = 68;
const WRAP_UNWRAP_FROM_AMOUNT_POS = 4;

const BYTES_28_LENGTH = 28;
const BYTES_64_LENGTH = 64;

const ZEROS_12_BYTES = hexZeroPad(hexlify(0), 12);
const ZEROS_28_BYTES = hexZeroPad(hexlify(0), 28);
const ZEROS_32_BYTES = hexZeroPad(hexlify(0), 32);

enum SpecialDex {
  DEFAULT = 0,
  // SWAP_ON_BALANCER_V2 = 1, // swapOnBalancerV2
  // SWAP_ON_MAKER_PSM = 2, // swapOnMakerPSM
  // SWAP_ON_SWAAP_V2 = 3, // swapOnSwaapV2
  SEND_NATIVE = 4, // sendNative
}

enum Flag {
  FIFTEEN = 15,
  ELEVEN = 11,
  NINE = 9,
  EIGHT = 8,
  SEVEN = 7,
  FIVE = 5,
  FOUR = 4,
  THREE = 3,
  ZERO = 0,
}

/**
 * Class to build bytecode for Executor01 (simpleSwap + multiSwap with 100% amounts on each path)
 */
export class Executor01BytecodeBuilder implements IExecutorBytecodeBuilder {
  erc20Interface: Interface;

  constructor(protected dexHelper: IDexHelper) {
    this.erc20Interface = new Interface(ERC20ABI);
  }

  protected buildDexCallData(
    swap: OptimalSwap,
    exchangeParam: DexExchangeParam,
    flag: Flag,
  ) {
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

    return solidityPack(EXECUTOR_01_FUNCTION_CALL_DATA_TYPES, [
      exchangeParam.targetExchange, // target exchange
      hexZeroPad(hexlify(hexDataLength(exchangeData) + BYTES_28_LENGTH), 4), // dex calldata length + bytes28(0)
      hexZeroPad(hexlify(fromAmountPos), 2), // fromAmountPos
      hexZeroPad(hexlify(destTokenPos), 2), // destTokenPos
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 2), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      exchangeData, // dex calldata
    ]);
  }

  protected buildApproveCallData(
    approveCalldata: string,
    tokenAddr: Address,
    amount: string,
    flag: Flag,
  ) {
    const insertFromAmount = flag % 4 === 3;
    const checkSrcTokenBalance = flag % 3 === 2;

    let fromAmountPos = 0;
    if (insertFromAmount) {
      const fromAmount = ethers.utils.defaultAbiCoder.encode(
        ['uint256'],
        [amount],
      );

      const fromAmountIndex = approveCalldata
        .replace('0x', '')
        .indexOf(fromAmount.replace('0x', ''));
      fromAmountPos = fromAmountIndex / 2;
    }

    if (checkSrcTokenBalance) {
      approveCalldata = hexConcat([approveCalldata, ZEROS_12_BYTES, tokenAddr]);
    }

    return solidityPack(EXECUTOR_01_FUNCTION_CALL_DATA_TYPES, [
      tokenAddr, // token address to approve
      hexZeroPad(hexlify(hexDataLength(approveCalldata) + BYTES_28_LENGTH), 4), // approve calldata length + bytes(28)
      hexZeroPad(hexlify(fromAmountPos), 2), // fromAmountPos
      hexZeroPad(hexlify(APPROVE_CALLDATA_DEST_TOKEN_POS), 2), // destTokenPos
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 2), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      approveCalldata, // approve calldata
    ]);
  }

  protected buildWrapEthCallData(depositCallData: string, flag: Flag) {
    return solidityPack(EXECUTOR_01_FUNCTION_CALL_DATA_TYPES, [
      this.dexHelper.config.data.wrappedNativeTokenAddress, // weth address
      hexZeroPad(hexlify(hexDataLength(depositCallData) + BYTES_28_LENGTH), 4), // wrap calldata length + bytes(28)
      hexZeroPad(hexlify(WRAP_UNWRAP_FROM_AMOUNT_POS), 2), // fromAmountPos
      hexZeroPad(hexlify(0), 2), // destTokenPos
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 2), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      depositCallData, // wrap calldata
    ]);
  }

  protected buildUnwrapEthCallData(withdrawCallData: string) {
    return solidityPack(EXECUTOR_01_FUNCTION_CALL_DATA_TYPES, [
      this.dexHelper.config.data.wrappedNativeTokenAddress, // weth address
      hexZeroPad(hexlify(hexDataLength(withdrawCallData) + BYTES_28_LENGTH), 4), // unwrap calldata length + bytes28(0)
      hexZeroPad(hexlify(WRAP_UNWRAP_FROM_AMOUNT_POS), 2), // fromAmountPos
      hexZeroPad(hexlify(0), 2), // destTokenPos
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 2), // special
      hexZeroPad(hexlify(Flag.SEVEN), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      withdrawCallData, // unwrap calldata
    ]);
  }

  protected buildTransferCallData(
    transferCallData: string,
    tokenAddr: Address,
  ) {
    return solidityPack(EXECUTOR_01_FUNCTION_CALL_DATA_TYPES, [
      tokenAddr, // token address
      hexZeroPad(hexlify(hexDataLength(transferCallData) + BYTES_28_LENGTH), 4), // unwrap calldata length + bytes28(0)
      hexZeroPad(hexlify(36), 2), // fromAmountPos
      hexZeroPad(hexlify(0), 2), // destTokenPos
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 2), // special
      hexZeroPad(hexlify(Flag.THREE), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      transferCallData, // unwrap calldata
    ]);
  }

  protected buildFinalSpecialFlagCalldata() {
    return solidityPack(
      ['bytes20', 'bytes4', 'bytes2', 'bytes2', 'bytes2', 'bytes2', 'bytes32'],
      [
        this.dexHelper.config.data.augustusV6Address, // augusutus v6 address
        hexZeroPad(hexlify(28 + 4), 4), // final unwrap calldata size bytes28(0) + bytes4(0)
        hexZeroPad(hexlify(0), 2), // fromAmountPos
        hexZeroPad(hexlify(0), 2), // destTokenPos
        hexZeroPad(hexlify(SpecialDex.SEND_NATIVE), 2), // special
        hexZeroPad(hexlify(9), 2), // flag
        ZEROS_32_BYTES, // bytes28(0) + bytes4(0)
      ],
    );
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

  protected buildFlags(
    priceRoute: OptimalRate,
    exchangeDataList: DexExchangeParam[],
    maybeWethCallData?: DepositWithdrawReturn,
  ): { approves: Flag[]; dexes: Flag[]; wrap: Flag } {
    const isMultiSwap = priceRoute.bestRoute[0].swaps.length > 1;
    const buildFlagsMethod = isMultiSwap
      ? this.buildMultiSwapFlags.bind(this)
      : this.buildSimpleSwapFlags.bind(this);

    const flags = exchangeDataList.reduce<{ dexes: Flag[]; approves: Flag[] }>(
      (acc, exchangeParam, index) => {
        const { dexFlag, approveFlag } = buildFlagsMethod(
          priceRoute,
          exchangeParam,
          index,
          maybeWethCallData,
        );

        acc.dexes.push(dexFlag);
        acc.approves.push(approveFlag);

        return acc;
      },
      { dexes: [], approves: [] },
    );

    return {
      ...flags,
      wrap:
        isETHAddress(priceRoute.srcToken) && maybeWethCallData?.deposit
          ? Flag.NINE
          : Flag.SEVEN,
    };
  }

  protected buildSingleSwapCallData(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    index: number,
    flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag },
    maybeWethCallData: DepositWithdrawReturn,
  ): string {
    let swapCallData = '';
    const swap = priceRoute.bestRoute[0].swaps[index];
    const curExchangeParam = exchangeParams[index];
    const srcAmount = swap.swapExchanges[0].srcAmount;

    const dexCallData = this.buildDexCallData(
      swap,
      curExchangeParam,
      flags.dexes[index],
    );

    swapCallData = hexConcat([dexCallData]);

    if (
      !isETHAddress(swap.srcToken) ||
      (isETHAddress(swap.srcToken) && index !== 0)
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

  public buildByteCode(
    priceRoute: OptimalRate,
    exchangeDataList: DexExchangeParam[],
    maybeWethCallData: DepositWithdrawReturn,
  ): string {
    const flags = this.buildFlags(
      priceRoute,
      exchangeDataList,
      maybeWethCallData,
    );

    let swapsCalldata = exchangeDataList.reduce<string>(
      (acc, exchangeParams, index) =>
        hexConcat([
          acc,
          this.buildSingleSwapCallData(
            priceRoute,
            exchangeDataList,
            index,
            flags,
            maybeWethCallData,
          ),
        ]),
      '0x',
    );

    if (
      !exchangeDataList[exchangeDataList.length - 1].dexFuncHasRecipient &&
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
      (!exchangeDataList[exchangeDataList.length - 1].dexFuncHasRecipient &&
        isETHAddress(priceRoute.destToken))
    ) {
      const finalSpecialFlagCalldata = this.buildFinalSpecialFlagCalldata();
      swapsCalldata = hexConcat([swapsCalldata, finalSpecialFlagCalldata]);
    }

    return solidityPack(
      ['bytes32', 'bytes', 'bytes'],
      [
        hexZeroPad(hexlify(32), 32),
        hexZeroPad(
          hexlify(hexDataLength(swapsCalldata) + BYTES_64_LENGTH), // 64 bytes = bytes12(0) + msg.sender
          32,
        ),
        swapsCalldata,
      ],
    );
  }
}
