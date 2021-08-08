import { JsonRpcProvider } from '@ethersproject/providers';
import { Interface } from '@ethersproject/abi';
import { DirectFunctions, IDex } from './idex';
import {
  Address,
  NumberAsString,
  AdapterExchangeParam,
  SimpleExchangeParam,
  TxInfo,
} from '../types';
import { SwapSide, ETHER_ADDRESS } from '../constants';
import { SimpleExchange } from './simple-exchange';
import UniswapV2RouterABI from '../abi/UniswapV2Router.json';
import UniswapV2ExchangeRouterABI from '../abi/UniswapV2ExchangeRouter.json';
import { UniswapData } from './uniswap-v2';

const UniswapV2ForkExchangeKeys = [
  'sushiswap',
  'defiswap',
  'linkswap',
  'pancakeswapv2',
  'apeswap',
  'bakeryswap',
  'julswap',
  'streetswap',
  'cometh',
  'dfyn',
  'mdex',
  'biswap',
  'waultfinance',
  'shibaswap',
  'coinswap',
  'sakeswap',
  'jetswap',
  'pantherswap',
];

type SwapOnUniswapForkParam = [
  factory: Address,
  initCode: string,
  amountIn: NumberAsString,
  amountOutMin: NumberAsString,
  path: Address[],
];

type BuyOnUniswapForkParam = [
  factory: Address,
  initCode: string,
  amountInMax: NumberAsString,
  amountOut: NumberAsString,
  path: Address[],
];

type UniswapForkParam = SwapOnUniswapForkParam | BuyOnUniswapForkParam;

const directUniswapFunctionName = {
  sell: 'swapOnUniswapFork',
  buy: 'buyOnUniswapFork',
};

export class UniswapV2Fork
  extends SimpleExchange
  implements IDex<UniswapData, UniswapForkParam>
{
  routerInterface: Interface;
  exchangeRouterInterface: Interface;
  static dexKeys = UniswapV2ForkExchangeKeys;
  static directFunctionName = directUniswapFunctionName;

  constructor(
    augustusAddress: Address,
    network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress);
    this.routerInterface = new Interface(UniswapV2RouterABI);
    this.exchangeRouterInterface = new Interface(UniswapV2ExchangeRouterABI);
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
    const { fee, feeFactor, factory, initCode } = data;
    // TODO: fix code for forks with variable fees
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          path: 'address[]',
          fee: 'uint256',
          feeFactor: 'uint256',
          factory: 'address',
          initCode: 'bytes32',
        },
      },
      { path, initCode, factory, fee: 10000 - fee[0], feeFactor },
    );

    return {
      targetExchange: data.router,
      payload,
      networkFee: '0',
    };
  }

  // TODO: fix code for forks with variable fees
  getSimpleParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const path = this.fixPath(data.path, src, dest);
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
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

  // TODO: fix code for forks with variable fees
  getDirectParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapData,
    side: SwapSide,
  ): TxInfo<UniswapForkParam> {
    const path = this.fixPath(data.path, src, dest);
    const encoder = (...params: UniswapForkParam) =>
      this.routerInterface.encodeFunctionData(
        side === SwapSide.SELL ? 'swapOnUniswapFork' : 'buyOnUniswapFork',
        params,
      );

    return {
      params: [data.factory, data.initCode, srcAmount, destAmount, path],
      encoder,
      networkFee: '0',
    };
  }

  static getDirectFunctionName(): DirectFunctions {
    return this.directFunctionName;
  }
}
