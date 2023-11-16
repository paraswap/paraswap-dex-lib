import { ethers } from 'ethers';
import { IDexHelper } from '../dex-helper';
import { DexExchangeParam } from '../types';
import { Address, OptimalRate } from '@paraswap/core';
import { isETHAddress } from '../utils';
import { DepositWithdrawReturn } from '../dex/weth/types';
import ERC20ABI from '../abi/erc20.json';
import { Interface } from '@ethersproject/abi';

const {
  utils: { hexlify, hexDataLength, hexConcat, hexZeroPad, solidityPack },
} = ethers;

const EXECUTOR_01_FUNCTION_DATA_TYPES: string[] = [
  'bytes20', // Address(bytes20)
  'bytes4', // Calldata Size(bytes 4)
  'bytes2', // fromAmount Pos(bytes2)
  'bytes2', // srcToken Pos(bytes2)
  'bytes2', // Special Exchange(bytes2)
  'bytes2', // Flags(bytes2)
  'bytes28', // Zero Padding (bytes28)
  'bytes', // Dex calldata (bytes)
];

const BYTES_28_LENGTH = 28;
const BYTES_64_LENGTH = 64;

const ZEROS_28_BYTES = hexZeroPad(hexlify(0), 28);
const ZEROS_32_BYTES = hexZeroPad(hexlify(0), 32);

/**
 * switch (flag mod 4):
 case 0: don't insert fromAmount
 case 1: sendEth equal to fromAmount
 case 2: sendEth equal to fromAmount + insert fromAmount
 case 3: insert fromAmount

 switch (flag mod 3):
 case 0: don't check balance after swap
 case 1: check eth balance after swap
 case 2: check "srcToken" balance after swap
 */

enum SpecialDex {
  DEFAULT = 0,
  SWAP_ON_BALANCER_V2 = 1, // swapOnBalancerV2
  SWAP_ON_MAKER_PSM = 2, // swapOnMakerPSM
  SWAP_ON_SWAAP_V2 = 3, // swapOnSwaapV2
  SEND_NATIVE = 4, // sendNative
}

enum Flag {
  TWELVE = 12,
  NINE = 9,
  EIGHT = 8,
  SEVEN = 7,
  FIVE = 5,
  FOUR = 4,
  THREE = 3,
  ZERO = 0,
}

/**
 * Class to build bytecode for Executor01
 */
export class Executor01BytecodeBuilder {
  erc20Interface: Interface;

  constructor(protected dexHelper: IDexHelper) {
    this.erc20Interface = new Interface(ERC20ABI);
  }

  protected buildDexCallData(
    priceRoute: OptimalRate,
    exchangeDataList: DexExchangeParam[],
    flag: Flag,
    maybeWethCallData?: DepositWithdrawReturn,
  ) {
    const checkSrcTokenBalanceAfterSwap = flag % 3 === 2;

    // We support 1 Dex for now
    const dexData = exchangeDataList[0];

    let srcTokenPos = 0;
    if (checkSrcTokenBalanceAfterSwap) {
      const srcTokenAddrForNextCall = maybeWethCallData?.withdraw
        ? this.dexHelper.config.data.wrappedNativeTokenAddress
        : priceRoute.destToken;

      const srcTokenAddrIndex = dexData.exchangeData
        .replace('0x', '')
        .indexOf(srcTokenAddrForNextCall.replace('0x', ''));
      srcTokenPos = (srcTokenAddrIndex - 24) / 2;
    }

    return solidityPack(EXECUTOR_01_FUNCTION_DATA_TYPES, [
      dexData.targetExchange, // target exchange
      hexZeroPad(
        hexlify(hexDataLength(dexData.exchangeData) + BYTES_28_LENGTH),
        4,
      ), // dex calldata length + bytes28(0)
      hexZeroPad(hexlify(0), 2), // fromAmountPos
      hexZeroPad(hexlify(srcTokenPos), 2), // srcTokenPos
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 2), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      dexData.exchangeData, // dex calldata
    ]);
  }

  protected buildApproveCallData(
    approveCalldata: string,
    tokenAddr: Address,
    flag: Flag,
  ) {
    return solidityPack(EXECUTOR_01_FUNCTION_DATA_TYPES, [
      tokenAddr, // token address to approve
      hexZeroPad(hexlify(hexDataLength(approveCalldata) + BYTES_28_LENGTH), 4), // approve calldata length + bytes(28)
      hexZeroPad(hexlify(0), 2), // fromAmountPos
      hexZeroPad(hexlify(0), 2), // srcTokenPos
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 2), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      approveCalldata,
    ]);
  }

  protected buildWrapEthCallData(depositCallData: string, flag: Flag) {
    return solidityPack(EXECUTOR_01_FUNCTION_DATA_TYPES, [
      this.dexHelper.config.data.wrappedNativeTokenAddress, // weth address
      hexZeroPad(hexlify(hexDataLength(depositCallData) + BYTES_28_LENGTH), 4), // wrap calldata length + bytes(28)
      hexZeroPad(hexlify(4), 2), // fromAmountPos
      hexZeroPad(hexlify(0), 2), // srcTokenPos
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 2), // special
      hexZeroPad(hexlify(flag), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      depositCallData, // wrap calldata
    ]);
  }

  protected buildUnwrapEthCallData(withdrawCallData: string) {
    return solidityPack(EXECUTOR_01_FUNCTION_DATA_TYPES, [
      this.dexHelper.config.data.wrappedNativeTokenAddress, // weth address
      hexZeroPad(hexlify(hexDataLength(withdrawCallData) + BYTES_28_LENGTH), 4), // unwrap calldata length + bytes28(0)
      hexZeroPad(hexlify(4), 2), // fromAmountPos
      hexZeroPad(hexlify(0), 2), // srcTokenPos
      hexZeroPad(hexlify(SpecialDex.DEFAULT), 2), // special
      hexZeroPad(hexlify(7), 2), // flag
      ZEROS_28_BYTES, // bytes28(0)
      withdrawCallData, // unwrap calldata
    ]);
  }

  protected buildTransferCallData(
    transferCallData: string,
    tokenAddr: Address,
  ) {
    return solidityPack(EXECUTOR_01_FUNCTION_DATA_TYPES, [
      tokenAddr, // token address
      hexZeroPad(hexlify(hexDataLength(transferCallData) + BYTES_28_LENGTH), 4), // unwrap calldata length + bytes28(0)
      hexZeroPad(hexlify(36), 2), // fromAmountPos
      hexZeroPad(hexlify(0), 2), // srcTokenPos
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
        hexZeroPad(hexlify(0), 2), // srcTokenPos
        hexZeroPad(hexlify(SpecialDex.SEND_NATIVE), 2), // special
        hexZeroPad(hexlify(9), 2), // flag
        ZEROS_32_BYTES, // bytes28(0) + bytes4(0)
      ],
    );
  }

  protected getFlags(
    priceRoute: OptimalRate,
    exchangeDataList: DexExchangeParam[],
    maybeWethCallData?: DepositWithdrawReturn,
  ): { approve: Flag; dex: Flag; wrap: Flag } {
    const { srcToken, destToken } = priceRoute;

    const needWrap = isETHAddress(srcToken) && maybeWethCallData?.deposit;
    const needUnwrap = isETHAddress(destToken) && maybeWethCallData?.withdraw;
    const isEthSrc = isETHAddress(srcToken) && !maybeWethCallData?.deposit;
    const isEthDest = isETHAddress(destToken) && !maybeWethCallData?.withdraw;
    const hasRecipient = exchangeDataList[0].dexFuncHasRecipient;

    let dexFlag = Flag.ZERO;
    if (isEthSrc) {
      dexFlag = Flag.FIVE;
    } else if (needWrap) {
      dexFlag = Flag.TWELVE;
    } else if (needUnwrap) {
      dexFlag = Flag.EIGHT;
    } else if (!hasRecipient && isEthDest) {
      dexFlag = Flag.FOUR;
    } else if (!hasRecipient) {
      dexFlag = Flag.EIGHT;
    }

    return {
      dex: dexFlag,
      wrap:
        isETHAddress(srcToken) && maybeWethCallData?.deposit
          ? Flag.NINE
          : Flag.SEVEN,
      approve: needWrap ? Flag.TWELVE : needUnwrap ? Flag.EIGHT : Flag.ZERO,
    };
  }

  public buildByteCode(
    priceRoute: OptimalRate,
    exchangeDataList: DexExchangeParam[],
    maybeWethCallData?: DepositWithdrawReturn,
  ): string {
    let finalCallData = '';
    const flags = this.getFlags(
      priceRoute,
      exchangeDataList,
      maybeWethCallData,
    );
    const dexCallData = this.buildDexCallData(
      priceRoute,
      exchangeDataList,
      flags.dex,
      maybeWethCallData,
    );

    finalCallData = hexConcat([dexCallData]);

    if (!isETHAddress(priceRoute.srcToken) || maybeWethCallData?.deposit) {
      const approveCallData = this.buildApproveCallData(
        this.erc20Interface.encodeFunctionData('approve', [
          exchangeDataList[0].targetExchange,
          priceRoute.srcAmount,
        ]),
        maybeWethCallData?.deposit
          ? this.dexHelper.config.data.wrappedNativeTokenAddress
          : priceRoute.srcToken,
        flags.approve,
      );
      finalCallData = hexConcat([approveCallData, finalCallData]);
    }

    if (maybeWethCallData) {
      if (maybeWethCallData.deposit) {
        const depositCallData = this.buildWrapEthCallData(
          maybeWethCallData.deposit.calldata,
          flags.wrap,
        );
        finalCallData = hexConcat([depositCallData, finalCallData]);
      }

      if (maybeWethCallData.withdraw) {
        const withdrawCallData = this.buildUnwrapEthCallData(
          maybeWethCallData.withdraw.calldata,
        );
        finalCallData = hexConcat([finalCallData, withdrawCallData]);
      }
    }

    if (
      !exchangeDataList[0].dexFuncHasRecipient &&
      !isETHAddress(priceRoute.destToken)
    ) {
      const transferCallData = this.buildTransferCallData(
        this.erc20Interface.encodeFunctionData('transfer', [
          this.dexHelper.config.data.augustusV6Address,
          priceRoute.destAmount,
        ]),
        priceRoute.destToken,
      );

      finalCallData = hexConcat([finalCallData, transferCallData]);
    }

    if (
      maybeWethCallData?.withdraw ||
      (!exchangeDataList[0].dexFuncHasRecipient &&
        isETHAddress(priceRoute.destToken))
    ) {
      const finalSpecialFlagCalldata = this.buildFinalSpecialFlagCalldata();
      finalCallData = hexConcat([finalCallData, finalSpecialFlagCalldata]);
    }

    return solidityPack(
      ['bytes32', 'bytes', 'bytes'],
      [
        hexZeroPad(hexlify(32), 32),
        hexZeroPad(
          hexlify(hexDataLength(finalCallData) + BYTES_64_LENGTH), // 64 bytes = bytes12(0) + msg.sender
          32,
        ),
        finalCallData,
      ],
    );
  }
}
