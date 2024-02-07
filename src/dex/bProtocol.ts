import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import {
  AdapterExchangeParam,
  Address,
  DexExchangeParam,
  NumberAsString,
  SimpleExchangeParam,
} from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import BProtocolABI from '../abi/BProtocol.json';
import { IDexHelper } from '../dex-helper';

export type BProtocolData = {
  exchange: string;
};
type BProtocolParam = [lusdAmount: string, minEthReturn: string, dest: string];
enum BProtocolFunctions {
  swap = 'swap',
}

export class BProtocol
  extends SimpleExchange
  implements IDexTxBuilder<BProtocolData, BProtocolParam>
{
  static dexKeys = ['bprotocol'];
  exchangeRouterInterface: Interface;

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'bprotocol');
    this.exchangeRouterInterface = new Interface(
      BProtocolABI as JsonFragment[],
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BProtocolData,
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
    data: BProtocolData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction = BProtocolFunctions.swap;
    const swapFunctionParams: BProtocolParam = [
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

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: BProtocolData,
    side: SwapSide,
  ): DexExchangeParam {
    const swapFunction = BProtocolFunctions.swap;
    const swapFunctionParams: BProtocolParam = [
      srcAmount,
      destAmount,
      recipient,
    ];
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );
    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      dexFuncHasDestToken: true,
      exchangeData: swapData,
      targetExchange: data.exchange,
    };
  }
}
