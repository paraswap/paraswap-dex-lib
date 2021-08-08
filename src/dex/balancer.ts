import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import BalancerABI from '../abi/Balancer.json';
import { isETHAddress } from '../utils';

type BalancerSwaps = {
  pool: Address;
  tokenInParam: string;
  tokenOutParam: string;
  maxPrice: string;
}[];

type BalancerData = {
  exchangeProxy: Address;
  swaps: BalancerSwaps;
};

type BalancerBatchEthInSwapExactInParam = [
  swaps: BalancerSwaps,
  destToken: string,
  destAmount: string,
];
type BalancerBatchEthOutSwapExactInParam = [
  swaps: BalancerSwaps,
  srcToken: string,
  srcAmount: string,
  destAmount: string,
];
type BalancerBatchSwapExactInParam = [
  swaps: BalancerSwaps,
  srcToken: string,
  destToken: string,
  srcAmount: string,
  destAmount: string,
];

type BalancerParam =
  | BalancerBatchEthInSwapExactInParam
  | BalancerBatchEthOutSwapExactInParam
  | BalancerBatchSwapExactInParam;

enum BalancerFunctions {
  batchEthInSwapExactIn = 'batchEthInSwapExactIn',
  batchEthOutSwapExactIn = 'batchEthOutSwapExactIn',
  batchSwapExactIn = 'batchSwapExactIn',
}

export class Balancer
  extends SimpleExchange
  implements IDex<BalancerData, BalancerParam>
{
  static dexKeys = ['balancer'];
  exchangeRouterInterface: Interface;
  minConversionRate = '1';

  constructor(augustusAddress: Address) {
    super(augustusAddress);
    this.exchangeRouterInterface = new Interface(BalancerABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BalancerData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { swaps } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          'swaps[]': {
            pool: 'address',
            tokenInParam: 'uint',
            tokenOutParam: 'uint',
            maxPrice: 'uint',
          },
        },
      },
      { swaps },
    );

    return {
      targetExchange: data.exchangeProxy,
      payload,
      networkFee: '0',
    };
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BalancerData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const { swaps } = data;

    const [swapFunction, swapFunctionParam] = ((): [
      swapFunction: string,
      swapFunctionParam: BalancerParam,
    ] => {
      if (isETHAddress(srcToken))
        return [
          BalancerFunctions.batchEthInSwapExactIn,
          [swaps, destToken, destAmount],
        ];

      if (isETHAddress(destToken))
        return [
          BalancerFunctions.batchEthOutSwapExactIn,
          [swaps, srcToken, srcAmount, destAmount],
        ];

      return [
        BalancerFunctions.batchSwapExactIn,
        [swaps, srcToken, destToken, srcAmount, destAmount],
      ];
    })();

    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParam,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.exchangeProxy,
    );
  }
}
