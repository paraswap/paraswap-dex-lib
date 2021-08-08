import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import UniswapV3RouterABI from '../abi/UniswapV3Router.json';
import { NumberAsString } from 'paraswap-core';

const UNISWAP_V3_ROUTER_ADDRESSES: { [networkid: number]: Address } = {
  1: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
};

export type UniswapV3Data = {
  // ExactInputSingleParams
  fee: number;
  deadline?: number;
  sqrtPriceLimitX96?: NumberAsString;
};
type UniswapV3Param = [
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  recipient: Address,
  deadline: number,
  amountIn: NumberAsString,
  amountOutMinimum: NumberAsString,
  sqrtPriceLimitX96: NumberAsString,
];
enum UniswapV3Functions {
  exactInputSingle = 'exactInputSingle',
}

export class UniswapV3
  extends SimpleExchange
  implements IDex<UniswapV3Data, UniswapV3Param>
{
  static dexKeys = ['uniswapv3'];
  exchangeRouterInterface: Interface;
  needWrapNative = true;

  constructor(augustusAddress: Address, private network: number) {
    super(augustusAddress);
    this.exchangeRouterInterface = new Interface(
      UniswapV3RouterABI as JsonFragment[],
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { fee, deadline, sqrtPriceLimitX96 } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          fee: 'uint24',
          deadline: 'uint256',
          sqrtPriceLimitX96: 'uint160',
        },
      },
      {
        fee,
        deadline: deadline || this.getDeadline(),
        sqrtPriceLimitX96: sqrtPriceLimitX96 || 0,
      },
    );

    return {
      targetExchange: UNISWAP_V3_ROUTER_ADDRESSES[this.network], // warning
      payload,
      networkFee: '0', // warning
    };
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV3Data,
    side: SwapSide,
  ): SimpleExchangeParam {
    const swapFunction = UniswapV3Functions.exactInputSingle;
    const swapFunctionParams: UniswapV3Param = [
      srcToken,
      destToken,
      data.fee,
      this.augustusAddress,
      data.deadline || this.getDeadline(),
      srcAmount,
      destAmount,
      data.sqrtPriceLimitX96 || '0',
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
      UNISWAP_V3_ROUTER_ADDRESSES[this.network], // warning
    );
  }
}
