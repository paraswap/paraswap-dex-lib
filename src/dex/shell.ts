import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import {
  getLocalDeadlineAsFriendlyPlaceholder,
  SimpleExchange,
} from './simple-exchange';
import ShellABI from '../abi/Shell.json';
import { IDexHelper } from '../dex-helper';

export type ShellData = {
  exchange: Address;
  deadline?: number;
};
type ShellParam = [
  _origin: string,
  _target: string,
  _originAmount: string,
  _minTargetAmount: string,
  _deadline: string,
];
enum ShellFunctions {
  originSwap = 'originSwap',
}

export class Shell
  extends SimpleExchange
  implements IDexTxBuilder<ShellData, ShellParam>
{
  static dexKeys = ['shell'];
  exchangeRouterInterface: Interface;

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'shell');
    this.exchangeRouterInterface = new Interface(ShellABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: ShellData,
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
    data: ShellData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction = ShellFunctions.originSwap;
    const swapFunctionParams: ShellParam = [
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      getLocalDeadlineAsFriendlyPlaceholder(),
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
