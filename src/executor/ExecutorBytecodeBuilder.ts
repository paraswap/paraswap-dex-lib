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
  DEFAULT_RETURN_AMOUNT_POS,
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

  protected abstract buildSingleSwapCallData(
    priceRoute: OptimalRate,
    exchangeParams: DexExchangeParam[],
    routeIndex: number,
    swapIndex: number,
    flags: { approves: Flag[]; dexes: Flag[]; wrap: Flag },
    sender: string,
    appendedWrapToSwapMap: { [key: number]: boolean },
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
      DEFAULT_RETURN_AMOUNT_POS, // return amount position
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 1), // special
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
      DEFAULT_RETURN_AMOUNT_POS, // return amount position
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 1), // special
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
      DEFAULT_RETURN_AMOUNT_POS, // return amount position
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 1), // special
      hexZeroPad(
        hexlify(Flag.INSERT_FROM_AMOUNT_CHECK_ETH_BALANCE_AFTER_SWAP),
        2,
      ), // flag
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
      DEFAULT_RETURN_AMOUNT_POS, // return amount position
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 1), // special
      hexZeroPad(
        hexlify(Flag.INSERT_FROM_AMOUNT_DONT_CHECK_BALANCE_AFTER_SWAP),
        2,
      ), // flag
      ZEROS_28_BYTES, // bytes28(0)
      transferCallData, // unwrap calldata
    ]);
  }

  protected buildFinalSpecialFlagCalldata(): string {
    return solidityPack(
      [
        'bytes20',
        'bytes4',
        'bytes2',
        'bytes2',
        'bytes1',
        'bytes1',
        'bytes2',
        'bytes32',
      ],
      [
        this.dexHelper.config.data.augustusV6Address, // augusutus v6 address
        hexZeroPad(hexlify(28 + 4), 4), // final unwrap calldata size bytes28(0) + bytes4(0)
        hexZeroPad(hexlify(0), 2), // fromAmountPos
        hexZeroPad(hexlify(0), 2), // destTokenPos
        DEFAULT_RETURN_AMOUNT_POS, // return amount position
        hexZeroPad(hexlify(SpecialDex.SEND_NATIVE), 1), // special
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
}
