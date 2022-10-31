import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import {
  AdapterExchangeParam,
  Address,
  NumberAsString,
  SimpleExchangeParam,
} from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import GenericFactoryZapABI from '../abi/curve-v2/GenericFactoryZap.json';
import CurveV2ABI from '../abi/CurveV2.json';
import Web3 from 'web3';
import { IDexHelper } from '../dex-helper';

export enum CurveV2SwapType {
  EXCHANGE,
  EXCHANGE_UNDERLYING,
  EXCHANGE_GENERIC_FACTORY_ZAP,
}

type CurveV2Data = {
  i: number;
  j: number;
  exchange: string;
  originalPoolAddress: Address;
  swapType: CurveV2SwapType;
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

enum CurveV2SwapFunctions {
  exchange = 'exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy)',
  exchange_underlying = 'exchange_underlying(uint256 i, uint256 j, uint256 dx, uint256 minDy)',
  exchange_in_generic_factory_zap = 'exchange(address _pool, uint256 i, uint256 j, uint256 _dx, uint256 _min_dy)',
}

export class CurveV2
  extends SimpleExchange
  implements IDexTxBuilder<CurveV2Data, CurveV2Param>
{
  static dexKeys = ['curvev2'];
  exchangeRouterInterface: Interface;
  genericFactoryZapIface: Interface;
  minConversionRate = '1';
  needWrapNative = true;

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'curvev2');
    this.exchangeRouterInterface = new Interface(CurveV2ABI as JsonFragment[]);
    this.genericFactoryZapIface = new Interface(GenericFactoryZapABI);
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
