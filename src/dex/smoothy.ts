import { Interface } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SwapSide } from '../constants';
import {
  AdapterExchangeParam,
  Address,
  NumberAsString,
  SimpleExchangeParam,
} from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import SmoothyABI from '../abi/Smoothy.json';

type SmoothyData = {
  exchange: string;
  i: string;
  j: string;
};

type SmoothyParam = [
  bTokenIdxIn: NumberAsString,
  bTokenIdxOut: NumberAsString,
  bTokenInAmount: NumberAsString,
  bTokenOutMin: NumberAsString,
];

enum SmoothyFunctions {
  swap = 'swap',
}

export class Smoothy
  extends SimpleExchange
  implements IDex<SmoothyData, SmoothyParam>
{
  static dexKeys = ['smoothy'];
  exchangeRouterInterface: Interface;
  minConversionRate = '1';

  constructor(
    augustusAddress: Address,
    public network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
    this.exchangeRouterInterface = new Interface(SmoothyABI);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: SmoothyData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { i, j } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          i: 'int128',
          j: 'int128',
        },
      },
      { i, j },
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
    data: SmoothyData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { exchange, i, j } = data;
    const swapFunctionParams: SmoothyParam = [i, j, srcAmount, destAmount];
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      SmoothyFunctions.swap,
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
