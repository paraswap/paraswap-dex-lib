import { Interface, JsonFragment } from '@ethersproject/abi';
import { NULL_ADDRESS, SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import { BUY_NOT_SUPPORTED_ERRROR } from '../constants';
import OneInchLpABI from '../abi/OneInchLp.json';
import { isETHAddress } from '../utils';

export type OneInchLpData = {
  exchange: string; // _DOUBLE_CHECK_
};
type OneInchLpParam = [
  src: string,
  dst: string,
  amount: string,
  minReturn: string,
  referral: string,
];
enum OneInchLpFunctions {
  swap = 'swap',
}

export class OneInchLp
  extends SimpleExchange
  implements IDex<OneInchLpData, OneInchLpParam>
{
  static ExchangeNames = ['oneinchlp'];
  exchangeRouterInterface: Interface;

  constructor(augustusAddress: Address, private network: number) {
    super(augustusAddress);
    this.exchangeRouterInterface = new Interface(
      OneInchLpABI as JsonFragment[],
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OneInchLpData,
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
    data: OneInchLpData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const swapFunction = OneInchLpFunctions.swap;
    const swapFunctionParams: OneInchLpParam = [
      isETHAddress(srcToken) ? NULL_ADDRESS : srcToken,
      isETHAddress(destToken) ? NULL_ADDRESS : destToken,
      srcAmount,
      destAmount,
      NULL_ADDRESS,
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
