import { Interface, JsonFragment } from '@ethersproject/abi';
import { Provider } from '@ethersproject/providers';
import { SwapSide, MAX_UINT } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import DodoV2ProxyABI from '../abi/dodo-v2-proxy.json';
import { NumberAsString } from 'paraswap-core';
import { isETHAddress } from '../utils';

const DODOAproveAddress: { [network: number]: Address } = {
  1: '0xCB859eA579b28e02B87A1FDE08d087ab9dbE5149',
  56: '0xa128Ba44B2738A558A1fdC06d6303d52D3Cef8c1',
  137: '0x6D310348d5c12009854DFCf72e0DF9027e8cb4f4',
};

export type DodoV2Data = {
  dodoPairs: Address[];
  directions: string;
  deadLine: string;
  dodoProxy: Address;
};
type DodoSwapV2ETHToTokenParams = [
  toToken: Address,
  minReturnAmount: NumberAsString,
  dodoPairs: Address[],
  directions: NumberAsString,
  isIncentive: boolean,
  deadLine: NumberAsString,
];
type DodoSwapV2TokenToETHParams = [
  fromToken: Address,
  fromTokenAmount: NumberAsString,
  minReturnAmount: NumberAsString,
  dodoPairs: Address[],
  directions: NumberAsString,
  isIncentive: boolean,
  deadLine: NumberAsString,
];
type DodoSwapV2TokenToTokenParams = [
  fromToken: Address,
  toToken: Address,
  fromTokenAmount: NumberAsString,
  minReturnAmount: NumberAsString,
  dodoPairs: Address[],
  directions: NumberAsString,
  isIncentive: boolean,
  deadLine: NumberAsString,
];
type DodoV2Param =
  | DodoSwapV2ETHToTokenParams
  | DodoSwapV2TokenToETHParams
  | DodoSwapV2TokenToTokenParams;
enum DodoV2Functions {
  dodoSwapV2ETHToToken = 'dodoSwapV2ETHToToken',
  dodoSwapV2TokenToETH = 'dodoSwapV2TokenToETH',
  dodoSwapV2TokenToToken = 'dodoSwapV2TokenToToken',
}

export class DodoV2
  extends SimpleExchange
  implements IDexTxBuilder<DodoV2Data, DodoV2Param>
{
  static dexKeys = ['dodov2'];
  exchangeRouterInterface: Interface;

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: Provider,
  ) {
    super(augustusAddress, provider);
    this.exchangeRouterInterface = new Interface(
      DodoV2ProxyABI as JsonFragment[],
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: DodoV2Data,
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
      targetExchange: data.dodoProxy, // warning
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: DodoV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const [swapFunction, swapFunctionParams, maybeSpender] = ((): [
      DodoV2Functions,
      DodoV2Param,
      Address?,
    ] => {
      if (isETHAddress(srcToken)) {
        return [
          DodoV2Functions.dodoSwapV2ETHToToken,
          [
            destToken,
            destAmount,
            data.dodoPairs,
            data.directions,
            false,
            MAX_UINT,
          ],
        ];
      }

      if (isETHAddress(destToken)) {
        return [
          DodoV2Functions.dodoSwapV2TokenToETH,
          [
            srcToken,
            srcAmount,
            destAmount,
            data.dodoPairs,
            data.directions,
            false,
            MAX_UINT,
          ],
          DODOAproveAddress[this.network],
        ];
      }

      return [
        DodoV2Functions.dodoSwapV2TokenToToken,
        [
          srcToken,
          destToken,
          srcAmount,
          destAmount,
          data.dodoPairs,
          data.directions,
          false,
          MAX_UINT,
        ],
        DODOAproveAddress[this.network],
      ];
    })();

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
      data.dodoProxy,
      maybeSpender,
    );
  }
}
