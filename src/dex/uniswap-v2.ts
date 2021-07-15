const web3Coder = require('web3-eth-abi');
import { Interface } from '@ethersproject/abi';
import { IDex } from './idex';
import {
  Address,
  NumberAsString,
  AdapterExchangeParam,
  SimpleExchangeParam,
  TxInfo,
} from '../types';
import { SwapSide, ETHER_ADDRESS } from '../constants';
import { SimpleExchange } from './simple-exchange';
import * as UniswapV2AdapterABI from '../abi/UniswapV2Adapter.json';
import * as UniswapV2RouterABI from '../abi/UniswapV2ExchangeRouter.json';

type UniswapData = {
  router: Address;
  path: Address[];
  factory: Address;
  initCode: string;
};

type SwapOnUniswapParam = [
  amountIn: NumberAsString,
  amountOutMin: NumberAsString,
  path: Address[],
];

type BuyOnUniswapParam = [
  amountInMax: NumberAsString,
  amountOut: NumberAsString,
  path: Address[],
];

type UniswapParam = SwapOnUniswapParam | BuyOnUniswapParam;

export class UniswapV2
  extends SimpleExchange
  implements IDex<UniswapData, UniswapParam>
{
  routerInterface: Interface;
  adapterInterface: Interface;
  constructor(augustusAddress: Address) {
    super(augustusAddress);
    this.routerInterface = new Interface(UniswapV2RouterABI);
    this.adapterInterface = new Interface(UniswapV2AdapterABI);
  }

  protected fixPath(path: Address[], srcToken: Address, destToken: Address) {
    return path.map((token: string, i: number) => {
      if (
        (i === 0 && srcToken.toLowerCase() === ETHER_ADDRESS.toLowerCase()) ||
        (i === path.length - 1 &&
          destToken.toLowerCase() === ETHER_ADDRESS.toLowerCase())
      )
        return ETHER_ADDRESS;
      return token;
    });
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    toAmount: NumberAsString, // required for buy case
    data: UniswapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const path = this.fixPath(data.path, srcToken, destToken);
    const payload = web3Coder.encodeParameter(
      {
        ParentStruct: {
          path: 'address[]',
        },
      },
      { path },
    );
    return {
      targetExchange: data.router,
      payload,
      networkFee: '0',
    };
  }

  getSimpleParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const path = this.fixPath(data.path, src, dest);
    const swapData = this.routerInterface.encodeFunctionData(
      side === SwapSide.SELL ? 'swap' : 'buy',
      [srcAmount, destAmount, path],
    );
    return this.buildSimpleParamWithoutWETHConversion(
      src,
      srcAmount,
      dest,
      destAmount,
      swapData,
      data.router,
    );
  }

  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapData,
    side: SwapSide,
  ): TxInfo<UniswapParam> {
    const path = this.fixPath(data.path, srcToken, destToken);
    const encoder = (...params: UniswapParam) =>
      this.routerInterface.encodeFunctionData(
        side === SwapSide.SELL ? 'swapOnUniswap' : 'buyOnUniswap',
        params,
      );
    return {
      params: [srcAmount, destAmount, path],
      encoder,
      networkFee: '0',
    };
  }
}
