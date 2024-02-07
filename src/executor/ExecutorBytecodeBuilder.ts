import { Interface } from '@ethersproject/abi';
import { IDexHelper } from '../dex-helper';
import ERC20ABI from '../abi/erc20.json';
import { ethers } from 'ethers';
import {
  Address,
  OptimalRate,
  OptimalSwap,
  OptimalSwapExchange,
} from '@paraswap/core';
import { DexExchangeParam } from '../types';
import { DepositWithdrawReturn } from '../dex/weth/types';
import { isETHAddress } from '../utils';
import {
  APPROVE_CALLDATA_DEST_TOKEN_POS,
  BYTES_28_LENGTH,
  EXECUTOR_01_02_FUNCTION_CALL_DATA_TYPES,
  EXECUTOR_03_FUNCTION_CALL_DATA_TYPES,
  WRAP_UNWRAP_FROM_AMOUNT_POS,
  ZEROS_12_BYTES,
  ZEROS_28_BYTES,
  ZEROS_4_BYTES,
} from './constants';
import { Executors, Flag, SpecialDex } from './types';

const {
  utils: { hexlify, hexDataLength, hexConcat, hexZeroPad, solidityPack },
} = ethers;

export abstract class ExecutorBytecodeBuilder {
  type!: Executors;
  erc20Interface: Interface;

  constructor(protected dexHelper: IDexHelper) {
    this.erc20Interface = new Interface(ERC20ABI);
  }

  protected abstract buildSimpleSwapFlags(
    priceRoute: OptimalRate,
    exchangeParam: DexExchangeParam,
    index: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag };

  protected abstract buildMultiSwapFlags(
    priceRoute: OptimalRate,
    exchangeParam: DexExchangeParam,
    index: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag };

  protected abstract buildSingleSwapCallData(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    index: number,
    flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag },
    sender: string,
    maybeWethCallData?: DepositWithdrawReturn,
    buildSingleSwapCallData?: OptimalSwap,
  ): string;

  public abstract buildByteCode(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    sender: string,
    maybeWethCallData?: DepositWithdrawReturn,
  ): string;

  public abstract getAddress(): string;

  protected abstract buildDexCallData(
    swap: OptimalSwap,
    exchangeParam: DexExchangeParam,
    index: number,
    flag: Flag,
    swapExchange?: OptimalSwapExchange<any>,
  ): string;

  protected buildApproveCallData(
    approveCalldata: string,
    tokenAddr: Address,
    amount: string,
    flag: Flag,
  ): string {
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

    return this.buildCallData(
      tokenAddr,
      approveCalldata,
      fromAmountPos,
      APPROVE_CALLDATA_DEST_TOKEN_POS,
      SpecialDex.DEFAULT,
      flag,
    );
  }

  protected buildWrapEthCallData(depositCallData: string, flag: Flag): string {
    return this.buildCallData(
      this.dexHelper.config.data.wrappedNativeTokenAddress, // weth address
      depositCallData,
      WRAP_UNWRAP_FROM_AMOUNT_POS,
      0,
      SpecialDex.DEFAULT,
      flag,
    );
  }

  protected buildUnwrapEthCallData(withdrawCallData: string): string {
    return this.buildCallData(
      this.dexHelper.config.data.wrappedNativeTokenAddress, // weth address
      withdrawCallData,
      WRAP_UNWRAP_FROM_AMOUNT_POS,
      0,
      SpecialDex.DEFAULT,
      Flag.SEVEN,
    );
  }

  protected buildTransferCallData(
    transferCallData: string,
    tokenAddr: Address,
  ): string {
    return this.buildCallData(
      tokenAddr,
      transferCallData,
      36,
      0,
      SpecialDex.DEFAULT,
      Flag.THREE,
      this.type === Executors.THREE ? hexDataLength(transferCallData) : 0,
    );
  }

  protected buildFinalSpecialFlagCalldata(): string {
    return this.buildCallData(
      this.dexHelper.config.data.augustusV6Address!, // augustus v6 address
      ZEROS_4_BYTES,
      0,
      0,
      SpecialDex.SEND_NATIVE,
      Flag.NINE,
    );
  }

  buildCallData(
    tokenAddress: string,
    calldata: string,
    fromAmountPos: number,
    destTokenPos: number,
    specialDexFlag: SpecialDex,
    flag: Flag,
    toAmountPos = 0,
  ): string {
    const isBuyExecutor = this.type === Executors.THREE;

    const types = isBuyExecutor
      ? EXECUTOR_03_FUNCTION_CALL_DATA_TYPES
      : EXECUTOR_01_02_FUNCTION_CALL_DATA_TYPES;

    const callDataLength = isBuyExecutor ? 2 : 4;

    return solidityPack(types, [
      tokenAddress, // token address
      hexZeroPad(
        hexlify(hexDataLength(calldata) + BYTES_28_LENGTH),
        callDataLength,
      ), // calldata length + bytes28(0)
      ...(isBuyExecutor ? [hexZeroPad(hexlify(toAmountPos), 2)] : []), // toAmountPos
      hexZeroPad(hexlify(fromAmountPos), 2), // fromAmountPos
      hexZeroPad(hexlify(destTokenPos), 2), // destTokenPos
      hexZeroPad(hexlify(specialDexFlag), 2), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      calldata, // calldata
    ]);
  }

  protected buildFlags(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    maybeWethCallData?: DepositWithdrawReturn,
  ): { approves: Flag[]; dexes: Flag[]; wrap: Flag } {
    const isMultiSwap = priceRoute.bestRoute[0].swaps.length > 1;
    const buildFlagsMethod = isMultiSwap
      ? this.buildMultiSwapFlags.bind(this)
      : this.buildSimpleSwapFlags.bind(this);

    const flags = exchangeParams.reduce<{ dexes: Flag[]; approves: Flag[] }>(
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
}
