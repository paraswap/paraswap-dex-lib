import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide, MAX_UINT } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import DodoV2ProxyABI from '../abi/dodo-v2-proxy.json';
import { NumberAsString } from 'paraswap-core';
import Web3 from 'web3';
import { IDexHelper } from '../dex-helper';

// We use dodo-v2 proxy as the new proxy supports both v1 and v2
const DODOV2ProxyAddress: { [network: number]: Address } = {
  1: '0xa356867fdcea8e71aeaf87805808803806231fdc',
  56: '0x8F8Dd7DB1bDA5eD3da8C9daf3bfa471c12d58486',
};

const DODOAproveAddress: { [network: number]: Address } = {
  1: '0xCB859eA579b28e02B87A1FDE08d087ab9dbE5149',
  56: '0xa128Ba44B2738A558A1fdC06d6303d52D3Cef8c1',
};

export type DodoV1Data = {
  fromToken: Address;
  toToken: Address;
  dodoPairs: Address[];
  directions: string;
  isIncentive: boolean;
  deadLine: string;
};

type DodoV1Param = [
  fromToken: Address,
  toToken: Address,
  fromTokenAmount: NumberAsString,
  minReturnAmount: NumberAsString,
  dodoPairs: Address[],
  directions: NumberAsString,
  isIncentive: boolean,
  deadLine: NumberAsString,
];
enum DodoV1Functions {
  dodoSwapV1 = 'dodoSwapV1',
}

export class DodoV1
  extends SimpleExchange
  implements IDexTxBuilder<DodoV1Data, DodoV1Param>
{
  static dexKeys = ['dodov1'];
  dodoV2Proxy: Interface;

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'dodov1');
    this.dodoV2Proxy = new Interface(DodoV2ProxyABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: DodoV1Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { dodoPairs, directions } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          dodoPairs: 'address[]',
          directions: 'uint256',
        },
      },
      { dodoPairs, directions },
    );

    return {
      targetExchange: DODOV2ProxyAddress[this.network],
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: DodoV1Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction = DodoV1Functions.dodoSwapV1;
    const swapFunctionParams: DodoV1Param = [
      srcToken,
      destToken,
      srcAmount,
      destAmount,
      data.dodoPairs,
      data.directions,
      data.isIncentive,
      MAX_UINT,
    ];
    const swapData = this.dodoV2Proxy.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      DODOV2ProxyAddress[this.network],
      DODOAproveAddress[this.network], // Warning
    );
  }
}
