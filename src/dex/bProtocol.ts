import { Interface, JsonFragment } from '@ethersproject/abi';
import { Provider } from '@ethersproject/providers';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import BProtocolABI from '../abi/BProtocol.json';

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

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: Provider,
  ) {
    super(augustusAddress, provider);
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
}
