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
  EXECUTORS_FUNCTION_CALL_DATA_TYPES,
  WRAP_UNWRAP_FROM_AMOUNT_POS,
  ZEROS_12_BYTES,
  ZEROS_28_BYTES,
  ZEROS_32_BYTES,
} from './constants';
import { Flag, SpecialDex } from './types';

const {
  utils: { hexlify, hexDataLength, hexConcat, hexZeroPad, solidityPack },
} = ethers;

export abstract class ExecutorBytecodeBuilder {
  erc20Interface: Interface;

  constructor(protected dexHelper: IDexHelper) {
    this.erc20Interface = new Interface(ERC20ABI);
    this.dexHelper.config.data;
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

    return solidityPack(EXECUTORS_FUNCTION_CALL_DATA_TYPES, [
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

  protected buildWrapEthCallData(depositCallData: string, flag: Flag): string {
    return solidityPack(EXECUTORS_FUNCTION_CALL_DATA_TYPES, [
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

  protected buildUnwrapEthCallData(withdrawCallData: string): string {
    return solidityPack(EXECUTORS_FUNCTION_CALL_DATA_TYPES, [
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
  ): string {
    return solidityPack(EXECUTORS_FUNCTION_CALL_DATA_TYPES, [
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

  protected buildFinalSpecialFlagCalldata(): string {
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
