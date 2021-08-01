import { Interface } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import {
  AdapterExchangeParam,
  Address,
  NumberAsString,
  SimpleExchangeParam,
} from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import StablePoolABI from '../abi/StablePool.json';
import { BUY_NOT_SUPPORTED_ERRROR } from '../constants';

type StablePoolData = {
  exchange: string;
  i: string;
  j: string;
  deadline: string;
};

type StablePoolParam = [
  i: NumberAsString,
  j: NumberAsString,
  dx: NumberAsString,
  min_dy: NumberAsString,
  deadline?: string,
];

enum StabePoolFunctions {
  swap = 'swap',
}

export class StablePool
  extends SimpleExchange
  implements IDex<StablePoolData, StablePoolParam>
{
  protected dexKeys = ['nerve', 'saddle', 'ironv2', 'smoothy'];
  exchangeRouterInterface: Interface;
  minConversionRate = '1';

  constructor(augustusAddress: Address) {
    super(augustusAddress);
    this.exchangeRouterInterface = new Interface(StablePoolABI);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: StablePoolData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side !== SwapSide.BUY) throw BUY_NOT_SUPPORTED_ERRROR;

    const { i, j, deadline } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          i: 'int128',
          j: 'int128',
          deadline: 'uint256',
        },
      },
      { i, j, deadline },
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
    data: StablePoolData,
    side: SwapSide,
  ): SimpleExchangeParam {
    if (side !== SwapSide.BUY) throw BUY_NOT_SUPPORTED_ERRROR;

    const { exchange, i, j, deadline } = data;
    const swapFunctionParams: StablePoolParam = [
      i,
      j,
      srcAmount,
      this.minConversionRate,
      deadline,
    ];
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      StabePoolFunctions.swap,
      swapFunctionParams,
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
