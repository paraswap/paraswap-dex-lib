import { Interface, JsonFragment } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import OnebitABI from '../abi/Onebit.json';

export type OnebitData = {
  router: Address;
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
  static dexKeys = ['omm1'];
  exchangeRouterInterface: Interface;
  needWrapNative = true;

  constructor(
    augustusAddress: Address,
    public network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
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
      targetExchange: data.router,
      payload: '0x',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OnebitData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
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
      data.router,
    );
  }
}
