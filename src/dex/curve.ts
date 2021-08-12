import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import {
  AdapterExchangeParam,
  Address,
  NumberAsString,
  SimpleExchangeParam,
} from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import CurveABI from '../abi/Curve.json';

export type CurveData = {
  exchange: string;
  i: string;
  j: string;
  deadline: string;
  underlyingSwap: boolean;
  v3: boolean;
};

type CurveParam = [
  i: NumberAsString,
  j: NumberAsString,
  dx: NumberAsString,
  min_dy: NumberAsString,
];

export enum CurveSwapFunctions {
  exchange = 'exchange',
  exchange_underlying = 'exchange_underlying',
}

export class Curve
  extends SimpleExchange
  implements IDex<CurveData, CurveParam>
{
  static dexKeys = [
    'curve',
    'curve3',
    'swerve',
    'acryptos',
    'beltfi',
    'ellipsis',
  ];
  exchangeRouterInterface: Interface;
  minConversionRate = '1';

  constructor(augustusAddress: Address) {
    super(augustusAddress);
    this.exchangeRouterInterface = new Interface(CurveABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { i, j, deadline, underlyingSwap, v3 } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          i: 'int128',
          j: 'int128',
          deadline: 'uint256',
          underlyingSwap: 'bool',
          v3: 'bool',
        },
      },
      { i, j, deadline, underlyingSwap, v3 },
    );

    return {
      targetExchange: data.exchange,
      payload,
      networkFee: '0',
    };
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveData,
    side: SwapSide,
  ): SimpleExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { exchange, i, j, underlyingSwap } = data;
    const defaultArgs = [i, j, srcAmount, this.minConversionRate];
    const swapMethod = underlyingSwap
      ? CurveSwapFunctions.exchange_underlying
      : CurveSwapFunctions.exchange;
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapMethod,
      defaultArgs,
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
