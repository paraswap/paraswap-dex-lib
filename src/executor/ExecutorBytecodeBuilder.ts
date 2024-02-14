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
  DEFAULT_RETURN_AMOUNT_POS,
  WRAP_UNWRAP_FROM_AMOUNT_POS,
  ZEROS_12_BYTES,
  ZEROS_28_BYTES,
  ZEROS_4_BYTES,
} from './constants';
import { Executors, Flag, SpecialDex } from './types';
import { MAX_UINT } from '../constants';

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
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParamIndex: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag };

  protected abstract buildMultiMegaSwapFlags(
    priceRoute: OptimalRate,
    exchangeParam: DexExchangeParam,
    routeIndex: number,
    swapIndex: number,
    swapExchangeIndex: number,
    exchangeParamIndex: number,
    maybeWethCallData?: DepositWithdrawReturn,
  ): { dexFlag: Flag; approveFlag: Flag };

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
    isLastSwap: boolean,
    flag: Flag,
    swapExchange?: OptimalSwapExchange<any>,
    maybeWethCallData?: DepositWithdrawReturn,
  ): string;

  protected buildApproveCallData(
    spender: string,
    tokenAddr: Address,
    flag: Flag,
  ): string {
    const amount = MAX_UINT;
    let approveCalldata = this.erc20Interface.encodeFunctionData('approve', [
      spender,
      amount,
    ]);

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
    exchangeParams: DexExchangeParam[],
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
          const curExchangeParam = exchangeParams[exchangeParamIndex];

          const { dexFlag, approveFlag } = buildFlagsMethod(
            priceRoute,
            curExchangeParam,
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
}
