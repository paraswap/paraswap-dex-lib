import { Interface, JsonFragment } from '@ethersproject/abi';
import { Provider } from '@ethersproject/providers';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import UniswapV3RouterABI from '../abi/UniswapV3Router.json';
import { NumberAsString } from 'paraswap-core';

const UNISWAP_V3_ROUTER_ADDRESSES: { [network: number]: Address } = {
  1: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  137: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
};

export type UniswapV3Data = {
  // ExactInputSingleParams
  deadline?: number;
  path: {
    tokenIn: Address;
    tokenOut: Address;
    fee: number;
  }[];
};

type UniswapV3SellParam = {
  path: string;
  recipient: Address;
  deadline: number;
  amountIn: NumberAsString;
  amountOutMinimum: NumberAsString;
};

type UniswapV3BuyParam = {
  path: string;
  recipient: Address;
  deadline: number;
  amountOut: NumberAsString;
  amountInMaximum: NumberAsString;
};

type UniswapV3Param = UniswapV3SellParam | UniswapV3BuyParam;

enum UniswapV3Functions {
  exactInput = 'exactInput',
  exactOutput = 'exactOutput',
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
    provider: Provider,
  ) {
    super(augustusAddress, provider);
    this.exchangeRouterInterface = new Interface(
      UniswapV3RouterABI as JsonFragment[],
    );
  }

  private encodePath(
    path: {
      tokenIn: Address;
      tokenOut: Address;
      fee: number;
    }[],
    side: SwapSide,
  ): string {
    let encodedPath = 0n;
    const _path = side === SwapSide.SELL ? path : path.reverse();
    for (let i = 0; i < path.length; i++) {
      const { tokenIn, tokenOut, fee } = path[i];
      const [a, b] =
        side === SwapSide.SELL ? [tokenIn, tokenOut] : [tokenOut, tokenIn];
      if (i === 0) encodedPath = (encodedPath << 160n) | BigInt(a);
      encodedPath = (encodedPath << 24n) | BigInt(fee);
      encodedPath = (encodedPath << 160n) | BigInt(b);
    }
    const hexString = encodedPath.toString(16);
    const padding = 40 + path.length * 46 - hexString.length;
    return '0x' + Array(padding).fill('0').join('') + hexString;
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { deadline, path: rawPath } = data;
    const path = this.encodePath(rawPath, side);
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          path: 'bytes',
          deadline: 'uint256',
        },
      },
      {
        path,
        deadline: deadline || this.getDeadline(),
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
        ? UniswapV3Functions.exactInput
        : UniswapV3Functions.exactOutput;
    const path = this.encodePath(data.path, side);
    const swapFunctionParams: UniswapV3Param =
      side === SwapSide.SELL
        ? {
            recipient: this.augustusAddress,
            deadline: data.deadline || this.getDeadline(),
            amountIn: srcAmount,
            amountOutMinimum: destAmount,
            path,
          }
        : {
            recipient: this.augustusAddress,
            deadline: data.deadline || this.getDeadline(),
            amountOut: destAmount,
            amountInMaximum: srcAmount,
            path,
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
