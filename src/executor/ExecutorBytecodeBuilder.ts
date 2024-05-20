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
import { DepositWithdrawReturn } from '../dex/weth/types';
import { isETHAddress } from '../utils';
import {
  APPROVE_CALLDATA_DEST_TOKEN_POS,
  BYTES_28_LENGTH,
  EXECUTOR_01_02_FUNCTION_CALL_DATA_TYPES,
  EXECUTOR_03_FUNCTION_CALL_DATA_TYPES,
  DEFAULT_RETURN_AMOUNT_POS,
  WRAP_UNWRAP_FROM_AMOUNT_POS,
  ZEROS_12_BYTES,
  ZEROS_28_BYTES,
  ZEROS_4_BYTES,
  DISABLED_MAX_UNIT_APPROVAL_TOKENS,
} from './constants';
import { Executors, Flag, SpecialDex } from './types';
import { MAX_UINT, Network } from '../constants';
import { DexExchangeBuildParam, DexExchangeParam } from '../types';

const {
  utils: { hexlify, hexDataLength, hexConcat, hexZeroPad, solidityPack },
} = ethers;

export type SingleSwapCallDataParams = {
  priceRoute: OptimalRate;
  exchangeParams: DexExchangeBuildParam[];
  index: number;
  routeIndex: number;
  swapIndex: number;
  wrapToSwapMap: { [key: number]: boolean };
  wrapToSwapExchangeMap: { [key: string]: boolean };
  flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag };
  sender: string;
  maybeWethCallData?: DepositWithdrawReturn;
  swap?: OptimalSwap;
};

export type DexCallDataParams = {
  priceRoute: OptimalRate;
  routeIndex: number;
  swapIndex: number;
  swapExchangeIndex: number;
  exchangeParams: DexExchangeBuildParam[];
  exchangeParamIndex: number;
  isLastSwap: boolean;
  flag: Flag;
  swapExchange?: OptimalSwapExchange<any>;
  maybeWethCallData?: DepositWithdrawReturn;
};

export abstract class ExecutorBytecodeBuilder {
  type!: Executors;
  erc20Interface: Interface;

  constructor(protected dexHelper: IDexHelper) {
    this.erc20Interface = new Interface(ERC20ABI);
  }

  protected buildSimpleSwapFlags(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeBuildParam[],
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParamIndex: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): {
    dexFlag: Flag;
    approveFlag: Flag;
  } {
    return {
      dexFlag:
        Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP,
      approveFlag: 0,
    };
  }

  protected buildMultiMegaSwapFlags(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeBuildParam[],
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParamIndex: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): {
    dexFlag: Flag;
    approveFlag: Flag;
  } {
    return {
      dexFlag:
        Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_CHECK_SRC_TOKEN_BALANCE_AFTER_SWAP,
      approveFlag: 0,
    };
  }

  public abstract buildByteCode(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeBuildParam[],
    sender: string,
    maybeWethCallData?: DepositWithdrawReturn,
  ): string;

  public abstract getAddress(): string;

  buildSingleSwapCallData(params: SingleSwapCallDataParams): string {
    return '0x';
  }

  protected buildDexCallData(params: DexCallDataParams): string {
    return '0x';
  }

  protected buildApproveCallData(
    spender: string,
    tokenAddr: Address,
    flag: Flag,
    amount = MAX_UINT,
  ): string {
    let approveCalldata = this.erc20Interface.encodeFunctionData('approve', [
      spender,
      amount,
    ]);

    // as approval given only for MAX_UNIT or 0, no need to use insertFromAmount flag
    const checkSrcTokenBalance = flag % 3 === 2;

    if (checkSrcTokenBalance) {
      approveCalldata = hexConcat([approveCalldata, ZEROS_12_BYTES, tokenAddr]);
    }

    let approvalCalldata = this.buildCallData(
      tokenAddr,
      approveCalldata,
      0,
      APPROVE_CALLDATA_DEST_TOKEN_POS,
      SpecialDex.DEFAULT,
      flag,
    );

    // add additional approval 0 for special cases
    if (
      amount !== '0' &&
      DISABLED_MAX_UNIT_APPROVAL_TOKENS?.[
        this.dexHelper.config.data.network as Network
      ]?.includes(tokenAddr)
    ) {
      approvalCalldata = hexConcat([
        this.buildApproveCallData(
          spender,
          tokenAddr,
          Flag.DONT_INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP,
          '0',
        ),
        approvalCalldata,
      ]);
    }

    return approvalCalldata;
  }

  protected buildWrapEthCallData(
    wethAddress: string,
    depositCallData: string,
    flag: Flag,
    destTokenPos = 0,
  ): string {
    return this.buildCallData(
      wethAddress,
      depositCallData,
      WRAP_UNWRAP_FROM_AMOUNT_POS,
      destTokenPos,
      SpecialDex.DEFAULT,
      flag,
    );
  }

  protected buildUnwrapEthCallData(
    wethAddress: string,
    withdrawCallData: string,
  ): string {
    return this.buildCallData(
      wethAddress, // weth address
      withdrawCallData,
      WRAP_UNWRAP_FROM_AMOUNT_POS,
      0,
      SpecialDex.DEFAULT,
      Flag.INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP, // 7
      hexDataLength(withdrawCallData),
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
      Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP, // 3
      hexDataLength(transferCallData),
    );
  }

  protected buildFinalSpecialFlagCalldata(): string {
    return this.buildCallData(
      this.dexHelper.config.data.augustusV6Address!, // augustus v6 address
      ZEROS_4_BYTES,
      0,
      0,
      SpecialDex.SEND_NATIVE,
      Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP, // 9
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
    const builder =
      this.type !== Executors.THREE
        ? this.buildExecutor0102CallData.bind(this)
        : this.buildExecutor03CallData.bind(this);

    return builder(
      tokenAddress,
      calldata,
      fromAmountPos,
      destTokenPos,
      specialDexFlag,
      flag,
      toAmountPos,
    );
  }

  private buildExecutor0102CallData(
    tokenAddress: string,
    calldata: string,
    fromAmountPos: number,
    destTokenPos: number,
    specialDexFlag: SpecialDex,
    flag: Flag,
  ) {
    return solidityPack(EXECUTOR_01_02_FUNCTION_CALL_DATA_TYPES, [
      tokenAddress, // token address
      hexZeroPad(hexlify(hexDataLength(calldata) + BYTES_28_LENGTH), 4), // calldata length + bytes28(0)
      hexZeroPad(hexlify(fromAmountPos), 2), // fromAmountPos
      hexZeroPad(hexlify(destTokenPos), 2), // destTokenPos
      hexZeroPad(hexlify(DEFAULT_RETURN_AMOUNT_POS), 1), // TODO: Fix returnAmount Pos
      hexZeroPad(hexlify(specialDexFlag), 1), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      calldata, // calldata
    ]);
  }

  private buildExecutor03CallData(
    tokenAddress: string,
    calldata: string,
    fromAmountPos: number,
    destTokenPos: number,
    specialDexFlag: SpecialDex,
    flag: Flag,
    toAmountPos = 0,
  ) {
    return solidityPack(EXECUTOR_03_FUNCTION_CALL_DATA_TYPES, [
      tokenAddress, // token address
      hexZeroPad(hexlify(hexDataLength(calldata) + BYTES_28_LENGTH), 2), // calldata length + bytes28(0)
      hexZeroPad(hexlify(toAmountPos), 2), // toAmountPos
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
    exchangeParams: DexExchangeBuildParam[],
    maybeWethCallData?: DepositWithdrawReturn,
  ): { approves: Flag[]; dexes: Flag[]; wrap: Flag } {
    const isMegaSwap = priceRoute.bestRoute.length > 1;
    const isMultiSwap = !isMegaSwap && priceRoute.bestRoute[0].swaps.length > 1;

    const buildFlagsMethod =
      isMultiSwap || isMegaSwap
        ? this.buildMultiMegaSwapFlags.bind(this)
        : this.buildSimpleSwapFlags.bind(this);

    let exchangeParamIndex = 0;
    let flags: { dexes: Flag[]; approves: Flag[] } = {
      dexes: [],
      approves: [],
    };

    priceRoute.bestRoute.map((route, routeIndex) => {
      route.swaps.map((swap, swapIndex) => {
        swap.swapExchanges.map((swapExchange, swapExchangeIndex) => {
          const { dexFlag, approveFlag } = buildFlagsMethod(
            priceRoute,
            exchangeParams,
            routeIndex,
            swapIndex,
            swapExchangeIndex,
            exchangeParamIndex,
            maybeWethCallData,
          );

          flags.dexes.push(dexFlag);
          flags.approves.push(approveFlag);

          exchangeParamIndex++;
        });
      });
    });

    return {
      ...flags,
      wrap:
        isETHAddress(priceRoute.srcToken) && maybeWethCallData?.deposit
          ? Flag.SEND_ETH_EQUAL_TO_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP // 9
          : Flag.INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP, // 7
    };
  }

  addTokenAddressToCallData(callData: string, tokenAddr: Address): string {
    const isTokenInCallData = callData
      .replace('0x', '')
      .indexOf(tokenAddr.replace('0x', ''));

    if (isTokenInCallData === -1) {
      callData = hexConcat([callData, ZEROS_12_BYTES, tokenAddr]);
    }

    return callData;
  }

  getApprovalTokenAndTarget(
    swap: OptimalSwap,
    exchangeParam: DexExchangeParam,
  ): { target: string; token: Address } | null {
    const target = exchangeParam.spender || exchangeParam.targetExchange;

    if (
      !isETHAddress(swap.srcToken) &&
      !exchangeParam.transferSrcTokenBeforeSwap
    ) {
      return {
        token: swap.srcToken,
        target,
      };
    }

    if (exchangeParam.needWrapNative && isETHAddress(swap.srcToken)) {
      return {
        token: this.getWETHAddress(exchangeParam),
        target,
      };
    }

    return null;
  }

  protected getWETHAddress(exchangeParam: DexExchangeParam): string {
    const { wethAddress } = exchangeParam;
    return (
      wethAddress ||
      this.dexHelper.config.data.wrappedNativeTokenAddress.toLowerCase()
    );
  }
}
