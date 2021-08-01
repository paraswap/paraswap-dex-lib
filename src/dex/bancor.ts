import { Interface, JsonFragment } from '@ethersproject/abi';
import { NULL_ADDRESS, SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import { BUY_NOT_SUPPORTED_ERRROR } from '../constants';
import BancorABI from '../abi/Bancor.json';

const BANCOR_NETWORK: { [network: string]: string } = {
  1: '0x2F9EC37d6CcFFf1caB21733BdaDEdE11c823cCB0',
};

export type BancorData = {
  minDestToken: string;
  path: Address[];
  bancorNetwork?: string;
};

type BancorParam = [
  path: Address[],
  srcAmount: string,
  minDestToken: string,
  affiliateAccount: string,
  affiliateFee: string,
];

enum BancorFunctions {
  convert2 = 'convert2',
}

export class Bancor
  extends SimpleExchange
  implements IDex<BancorData, BancorParam>
{
  protected dexKeys = ['bancor'];
  exchangeRouterInterface: Interface;

  constructor(augustusAddress: Address, private network: number) {
    super(augustusAddress);
    this.exchangeRouterInterface = new Interface(BancorABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BancorData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side !== SwapSide.BUY) throw BUY_NOT_SUPPORTED_ERRROR;

    const { path } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          path: 'address[]',
        },
      },
      { path },
    );

    return {
      targetExchange: data.bancorNetwork || BANCOR_NETWORK[this.network],
      payload,
      networkFee: '0',
    };
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BancorData,
    side: SwapSide,
  ): SimpleExchangeParam {
    if (side !== SwapSide.BUY) throw BUY_NOT_SUPPORTED_ERRROR;

    const defaultArgs = [
      data.path,
      srcAmount,
      data.minDestToken,
      NULL_ADDRESS,
      '0',
    ];
    const swapMethod = BancorFunctions.convert2;
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapMethod,
      defaultArgs,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.bancorNetwork || BANCOR_NETWORK[this.network],
    );
  }
}
