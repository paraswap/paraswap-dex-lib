import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import {
  AdapterExchangeParam,
  Address,
  NumberAsString,
  SimpleExchangeParam,
  TxInfo,
} from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import GenericFactoryZapABI from '../abi/curve-v2/GenericFactoryZap.json';
import DirectSwapABI from '../abi/DirectSwap.json';
import CurveV2ABI from '../abi/CurveV2.json';
import Web3 from 'web3';
import { IDexHelper } from '../dex-helper';
import { assert } from 'ts-essentials';
import { Logger } from 'log4js';

export enum CurveV2SwapType {
  EXCHANGE,
  EXCHANGE_UNDERLYING,
  EXCHANGE_GENERIC_FACTORY_ZAP,
}

const DIRECT_METHOD_NAME = 'directCurveSwap';

type CurveV2Data = {
  i: number;
  j: number;
  exchange: string;
  originalPoolAddress: Address;
  swapType: CurveV2SwapType;
  isApproved?: boolean;
};

type CurveV2Param = [
  i: NumberAsString,
  j: NumberAsString,
  dx: NumberAsString,
  min_dy: NumberAsString,
  ethDeposit?: boolean,
];

type CurveV2ParamsForGenericFactoryZap = [
  _pool: Address,
  i: NumberAsString,
  j: NumberAsString,
  dx: NumberAsString,
  min_dy: NumberAsString,
];

export type DirectCurveParam = [
  fromToken: Address,
  toToken: Address,
  poolAddress: Address,
  fromAmount: NumberAsString,
  toAmount: NumberAsString,
  expectedAmount: NumberAsString,
  feePercent: NumberAsString,
  i: NumberAsString,
  j: NumberAsString,
  partner: Address,
  isApproved: boolean,
  beneficiary: Address,
  underlyingSwap: boolean,
  curveV1Swap: boolean,
  stEthSwap: boolean,
  permit: string,
  uuid: string,
];

enum CurveV2SwapFunctions {
  exchange = 'exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy)',
  exchange_underlying = 'exchange_underlying(uint256 i, uint256 j, uint256 dx, uint256 minDy)',
  exchange_in_generic_factory_zap = 'exchange(address _pool, uint256 i, uint256 j, uint256 _dx, uint256 _min_dy)',
}

export class CurveV2
  extends SimpleExchange
  implements IDexTxBuilder<CurveV2Data, DirectCurveParam>
{
  static dexKeys = ['curvev2'];
  exchangeRouterInterface: Interface;
  genericFactoryZapIface: Interface;
  minConversionRate = '1';
  needWrapNative = true;
  logger: Logger;

  readonly directSwapIface = new Interface(DirectSwapABI);

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'curvev2');
    this.exchangeRouterInterface = new Interface(CurveV2ABI as JsonFragment[]);
    this.genericFactoryZapIface = new Interface(GenericFactoryZapABI);
    this.logger = dexHelper.getLogger(
      `CurveV2_${dexHelper.config.data.network}`,
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { i, j, originalPoolAddress, swapType } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          i: 'uint256',
          j: 'uint256',
          originalPoolAddress: 'address',
          swapType: 'uint8',
        },
      },
      {
        i,
        j,
        originalPoolAddress,
        swapType,
      },
    );

    return {
      targetExchange: data.exchange,
      payload,
      networkFee: '0',
    };
  }

  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    expectedAmount: NumberAsString,
    data: CurveV2Data,
    side: SwapSide,
    permit: string,
    uuid: string,
    feePercent: NumberAsString,
    deadline: NumberAsString,
    partner: string,
    beneficiary: string,
    contractMethod?: string,
  ): TxInfo<DirectCurveParam> {
    if (contractMethod !== DIRECT_METHOD_NAME) {
      throw new Error(`Invalid contract method ${contractMethod}`);
    }
    assert(side === SwapSide.SELL, 'Buy not supported');

    let isApproved: boolean = !!data.isApproved;
    if (data.isApproved === undefined) {
      this.logger.warn(`isApproved is undefined, defaulting to false`);
    }

    const swapParams: DirectCurveParam = [
      srcToken,
      destToken,
      data.exchange,
      srcAmount,
      destAmount,
      expectedAmount,
      feePercent,
      data.i.toString(),
      data.j.toString(),
      partner,
      isApproved,
      beneficiary,
      data.swapType === CurveV2SwapType.EXCHANGE_UNDERLYING,
      false,
      true,
      permit,
      uuid,
    ];

    const encoder = (...params: DirectCurveParam) => {
      return this.directSwapIface.encodeFunctionData(DIRECT_METHOD_NAME, [
        params,
      ]);
    };

    return {
      params: swapParams,
      encoder,
      networkFee: '0',
    };
  }

  static getDirectFunctionName(): string[] {
    return [];
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { exchange, i, j, originalPoolAddress, swapType } = data;

    const args: CurveV2Param | CurveV2ParamsForGenericFactoryZap =
      swapType === CurveV2SwapType.EXCHANGE_GENERIC_FACTORY_ZAP
        ? [
            originalPoolAddress,
            i.toString(),
            j.toString(),
            srcAmount,
            this.minConversionRate,
          ]
        : [i.toString(), j.toString(), srcAmount, this.minConversionRate];

    let swapMethod: string;
    switch (swapType) {
      case CurveV2SwapType.EXCHANGE:
        swapMethod = CurveV2SwapFunctions.exchange;
        break;
      case CurveV2SwapType.EXCHANGE_UNDERLYING:
        swapMethod = CurveV2SwapFunctions.exchange_underlying;
        break;
      case CurveV2SwapType.EXCHANGE_GENERIC_FACTORY_ZAP:
        swapMethod = CurveV2SwapFunctions.exchange_in_generic_factory_zap;
        break;
      default:
        throw new Error(
          `getSimpleParam: not all cases covered for CurveV2SwapTypes`,
        );
    }

    const swapData =
      swapMethod === CurveV2SwapFunctions.exchange_in_generic_factory_zap
        ? this.genericFactoryZapIface.encodeFunctionData(swapMethod, args)
        : this.exchangeRouterInterface.encodeFunctionData(swapMethod, args);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }
}
