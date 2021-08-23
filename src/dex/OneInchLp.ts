import { Interface, JsonFragment } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { NULL_ADDRESS, SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
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
  static dexKeys = ['oneinchlp'];
  exchangeRouterInterface: Interface;

  constructor(
    augustusAddress: Address,
    public network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
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

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: OneInchLpData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
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
