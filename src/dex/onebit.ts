import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import OnebitABI from '../abi/Onebit.json';
import { IDexHelper } from '../dex-helper';

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
  implements IDexTxBuilder<OnebitData, OnebitParam>
{
  static dexKeys = ['omm1'];
  exchangeRouterInterface: Interface;
  needWrapNative = true;

  constructor(dexHelper: IDexHelper, dexKey: string) {
    super(dexHelper, dexKey);
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
