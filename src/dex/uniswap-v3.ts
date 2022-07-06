import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import UniswapV3RouterABI from '../abi/UniswapV3Router.json';
import { NumberAsString } from 'paraswap-core';
import Web3 from 'web3';

const UNISWAP_V3_ROUTER_ADDRESSES: { [network: number]: Address } = {
  1: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  137: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
};

export type UniswapV3Data = {
  // ExactInputSingleParams
  fee: number;
  deadline?: number;
  sqrtPriceLimitX96?: NumberAsString;
};

type UniswapV3SellParam = {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  deadline: number;
  amountIn: NumberAsString;
  amountOutMinimum: NumberAsString;
  sqrtPriceLimitX96: NumberAsString;
};

type UniswapV3BuyParam = {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  deadline: number;
  amountOut: NumberAsString;
  amountInMaximum: NumberAsString;
  sqrtPriceLimitX96: NumberAsString;
};

type UniswapV3Param = UniswapV3SellParam | UniswapV3BuyParam;

enum UniswapV3Functions {
  exactInputSingle = 'exactInputSingle',
  exactOutputSingle = 'exactOutputSingle',
}

export class UniswapV3
  extends SimpleExchange
  implements IDexTxBuilder<UniswapV3Data, UniswapV3Param>
{
  static dexKeys = ['uniswapv3'];
  exchangeRouterInterface: Interface;
  needWrapNative = true;

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: Web3,
  ) {
    super(augustusAddress, provider);
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

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV3Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? UniswapV3Functions.exactInputSingle
        : UniswapV3Functions.exactOutputSingle;
    const swapFunctionParams: UniswapV3Param =
      side === SwapSide.SELL
        ? {
            tokenIn: srcToken,
            tokenOut: destToken,
            fee: data.fee,
            recipient: this.augustusAddress,
            deadline: data.deadline || this.getDeadline(),
            amountIn: srcAmount,
            amountOutMinimum: destAmount,
            sqrtPriceLimitX96: data.sqrtPriceLimitX96 || '0',
          }
        : {
            tokenIn: srcToken,
            tokenOut: destToken,
            fee: data.fee,
            recipient: this.augustusAddress,
            deadline: data.deadline || this.getDeadline(),
            amountOut: destAmount,
            amountInMaximum: srcAmount,
            sqrtPriceLimitX96: data.sqrtPriceLimitX96 || '0',
          };
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      [swapFunctionParams],
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
