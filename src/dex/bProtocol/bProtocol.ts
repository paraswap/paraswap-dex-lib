import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../../constants';
import {
  AdapterExchangeParam,
  Address,
  DexExchangeParam,
  NumberAsString,
  SimpleExchangeParam,
} from '../../types';
import { IDexTxBuilder } from '../idex';
import { SimpleExchange } from '../simple-exchange';
import BProtocolABI from '../../abi/BProtocol.json';
import { IDexHelper } from '../../dex-helper';
import { BProtocolData, BProtocolFunctions, BProtocolParam } from './types';
import { extractReturnAmountPosition } from '../../executor/utils';

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
    _srcToken: Address,
    _destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: BProtocolData,
    _side: SwapSide,
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
      exchangeData: swapData,
      targetExchange: data.exchange,
      returnAmountPos:
        _side === SwapSide.SELL
          ? extractReturnAmountPosition(
              this.exchangeRouterInterface,
              swapFunction,
            )
          : undefined,
    };
  }
}
