import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import OnebitABI from '../abi/Onebit.json';

export type OnebitData = {
  exchange: Address;
};
type OnebitParam = [
  srcToken: string,
  destToken: string,
  srcAmount: string,
  destAmountMin: string,
  to: string,
];
enum OnebitFunctions {
  swapTokensWithTrust = 'swapTokensWithTrust',
}

export class Onebit
  extends SimpleExchange
  implements IDex<OnebitData, OnebitParam>
{
  static dexKeys = ['onebit'];
  exchangeRouterInterface: Interface;
  needWrapNative = true;

  constructor(augustusAddress: Address, private network: number) {
    super(augustusAddress);
    this.exchangeRouterInterface = new Interface(OnebitABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OnebitData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: data.exchange,
      payload: '0x',
      networkFee: '0',
    };
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OnebitData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const swapFunction = OnebitFunctions.swapTokensWithTrust;
    const swapFunctionParams: OnebitParam = [
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      this.augustusAddress,
    ];
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.exchange,
    );
  }
}
