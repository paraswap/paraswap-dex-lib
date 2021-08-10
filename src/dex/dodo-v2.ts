import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import DodoV2ProxyABI from '../abi/dodo-v2-proxy.json';
import { NumberAsString } from 'paraswap-core';
import { isETHAddress } from '../utils';

const MAX_UINT =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

const DODOV2ProxyAddress: { [network: number]: Address } = {
  1: '0xa356867fdcea8e71aeaf87805808803806231fdc',
  56: '0x8F8Dd7DB1bDA5eD3da8C9daf3bfa471c12d58486',
};

const DODOAproveAddress: { [network: number]: Address } = {
  1: '0xCB859eA579b28e02B87A1FDE08d087ab9dbE5149',
  56: '0xa128Ba44B2738A558A1fdC06d6303d52D3Cef8c1',
};

export type DodoV2Data = {
  fromToken: Address;
  toToken: Address;
  dodoPairs: Address[];
  directions: string;
  isIncentive: boolean;
  deadLine: string;
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
  implements IDex<DodoV2Data, DodoV2Param>
{
  static dexKeys = ['dodov2'];
  exchangeRouterInterface: Interface;

  constructor(augustusAddress: Address, private network: number) {
    super(augustusAddress);
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
      targetExchange: DODOV2ProxyAddress[this.network], // warning
      payload,
      networkFee: '0',
    };
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: DodoV2Data,
    side: SwapSide,
  ): SimpleExchangeParam {
    const [swapFunction, swapFunctionParams, maybeSpender] = ((): [
      DodoV2Functions,
      DodoV2Param,
      Address?,
    ] => {
      if (isETHAddress(srcToken)) {
        return [
          DodoV2Functions.dodoSwapV2ETHToToken,
          [
            data.toToken,
            destAmount,
            data.dodoPairs,
            data.directions,
            data.isIncentive,
            MAX_UINT,
          ],
        ];
      }

      if (isETHAddress(destToken)) {
        return [
          DodoV2Functions.dodoSwapV2TokenToETH,
          [
            data.fromToken,
            srcAmount,
            destAmount,
            data.dodoPairs,
            data.directions,
            data.isIncentive,
            data.deadLine,
          ],
          DODOAproveAddress[this.network],
        ];
      }

      return [
        DodoV2Functions.dodoSwapV2TokenToToken,
        [
          data.fromToken,
          data.toToken,
          srcAmount,
          destAmount,
          data.dodoPairs,
          data.directions,
          data.isIncentive,
          data.deadLine,
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
      DODOV2ProxyAddress[this.network],
      maybeSpender,
    );
  }
}
