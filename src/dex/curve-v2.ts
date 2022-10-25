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
import CurveV2ABI from '../abi/CurveV2.json';
import Web3 from 'web3';

type CurveV2Data = {
  i: number;
  j: number;
  exchange: string;
  underlyingSwap: boolean;
  isFactoryGenericZap: boolean;
  originalPoolAddress: Address;
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
  use_eth: boolean,
];

enum CurveV2SwapFunctions {
  exchange = 'exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy)',
  exchange_underlying = 'exchange_underlying(uint256 i, uint256 j, uint256 dx, uint256 minDy)',
  exchange_in_generic_factory_zap = 'exchange(address _pool, uint256 i, uint256 j, uint256 _dx, uint256 _min_dy, bool _use_eth)',
}

export class CurveV2
  extends SimpleExchange
  implements IDexTxBuilder<CurveV2Data, CurveV2Param>
{
  static dexKeys = ['curvev2'];
  exchangeRouterInterface: Interface;
  minConversionRate = '1';
  needWrapNative = true;

  constructor(
    augustusAddress: Address,
    public network: number,
    provider: Web3,
  ) {
    super(augustusAddress, provider);
    this.exchangeRouterInterface = new Interface(CurveV2ABI as JsonFragment[]);
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

    const { i, j, underlyingSwap, isFactoryGenericZap, originalPoolAddress } =
      data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          i: 'uint256',
          j: 'uint256',
          underlyingSwap: 'bool',
          isFactoryGenericZap: 'bool',
          originalPoolAddress: 'address',
          useEth: 'bool',
        },
      },
      {
        i,
        j,
        underlyingSwap,
        isFactoryGenericZap,
        originalPoolAddress,
        useEth: false,
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

    const {
      exchange,
      i,
      j,
      underlyingSwap,
      isFactoryGenericZap,
      originalPoolAddress,
    } = data;
    const args: CurveV2Param | CurveV2ParamsForGenericFactoryZap =
      isFactoryGenericZap
        ? [
            originalPoolAddress,
            i.toString(),
            j.toString(),
            srcAmount,
            this.minConversionRate,
            false,
          ]
        : [i.toString(), j.toString(), srcAmount, this.minConversionRate];
    const swapMethod = underlyingSwap
      ? isFactoryGenericZap
        ? CurveV2SwapFunctions.exchange_in_generic_factory_zap
        : CurveV2SwapFunctions.exchange_underlying
      : CurveV2SwapFunctions.exchange;
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapMethod,
      args,
    );

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
