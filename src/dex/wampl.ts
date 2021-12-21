import { Interface, JsonFragment } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SwapSide, NULL_ADDRESS } from '../constants';
import { NumberAsString } from 'paraswap-core';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import ButtonWrapper from '../abi/IButtonWrapper.json';
import Erc20 from '../abi/erc20.json';
import { isETHAddress } from '../utils';

export const WAMPLAddresses: any = {
  1: '0xEDB171C18cE90B633DB442f2A6F72874093b49Ef',
};

export type WAMPLData = {};
type WAMPLParam = [srcAmount: NumberAsString];
enum WAMPLFunctions {
  deposit = 'deposit',
  withdraw = 'withdraw',
}

export class WAMPL
  extends SimpleExchange
  implements IDex<WAMPLData, WAMPLParam>
{
  static dexKeys = ['wampl'];
  wrapperInterface: Interface;
  erc20Interface: Interface;

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
    this.wrapperInterface = new Interface(ButtonWrapper as JsonFragment[]);
    this.erc20Interface = new Interface(Erc20 as JsonFragment[]);
  }

  static getAddress(network: number = 1): Address {
    return WAMPLAddresses[network];
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: WAMPLData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: WAMPL.getAddress(this.network),
      payload: '0x',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: WAMPLData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {

    const wrapperAddress = WAMPL.getAddress(this.network)

    let swapData:string;

    // AMPL to WAMPL
    if(wrapperAddress.toLowerCase() === destToken.toLowerCase()) {
      swapData = this.wrapperInterface.encodeFunctionData(
        WAMPLFunctions.deposit,
        [srcAmount]
      )
    }

    // WAMPL to AMPL
    else if(wrapperAddress.toLowerCase() === srcToken.toLowerCase()) {
      swapData = this.wrapperInterface.encodeFunctionData(
        WAMPLFunctions.withdraw,
        [srcAmount]
      )
    }

    else {
      throw new Error('Neither src/dest is WAMPL')
    }

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      wrapperAddress,
    );
  }
}
