import { JsonRpcProvider } from '@ethersproject/providers';
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
import ParaSwapABI from '../abi/IParaswap.json';
import UniswapV2ExchangeRouterABI from '../abi/UniswapV2ExchangeRouter.json';
import { UniswapData, UniswapV2Functions } from './uniswap-v2';
import { prependWithOx } from '../utils';

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
type SwapOnUniswapV2ForkParam = [
  tokenIn: Address,
  tokenOut: Address,
  amountIn: Address,
  amountOutMin: Address,
  weth: Address,
  pools: Address[],
];
type BuyOnUniswapV2ForkParam = [
  tokenIn: Address,
  tokenOut: Address,
  amountInMax: Address,
  amountOut: Address,
  weth: Address,
  pools: Address[],
];
type UniswapForkParam =
  | SwapOnUniswapForkParam
  | BuyOnUniswapForkParam
  | SwapOnUniswapV2ForkParam
  | BuyOnUniswapV2ForkParam;

const directUniswapFunctionName = [
  UniswapV2Functions.swapOnUniswapFork,
  UniswapV2Functions.buyOnUniswapFork,
  UniswapV2Functions.swapOnUniswapV2Fork,
  UniswapV2Functions.buyOnUniswapV2Fork,
];

type UniswapPool = {
  address: Address;
  direction: boolean;
  fee: number;
};

type UniswapV2ForkDataNew = {
  router: Address;
  pools: UniswapPool[];
  weth: Address;
};

type UniswapV2ForkData = UniswapData | UniswapV2ForkDataNew;

const isUniswapV2ForkDataNew = (
  d: UniswapV2ForkData,
): d is UniswapV2ForkDataNew => !!(d as UniswapV2ForkDataNew).pools;

function encodePools(pools: UniswapPool[]): NumberAsString[] {
  return pools.map(({ fee, direction, address }) => {
    return (
      (BigInt(10000) - BigInt(fee)) * BigInt(2) ** BigInt(161) +
      (direction ? BigInt(0) : BigInt(1)) * BigInt(2) ** BigInt(160) +
      BigInt(address)
    ).toString();
  });
}

export class UniswapV2Fork
  extends SimpleExchange
  implements IDex<UniswapV2ForkData, UniswapForkParam>
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
    this.routerInterface = new Interface(ParaSwapABI);
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
    data: UniswapV2ForkData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (isUniswapV2ForkDataNew(data)) {
      const pools = encodePools(data.pools);
      const { weth } = data;
      const payload = this.abiCoder.encodeParameter(
        {
          ParentStruct: {
            pools: 'uint256[]',
            weth: 'address',
          },
        },
        { pools, weth },
      );
      return {
        targetExchange: data.router,
        payload,
        networkFee: '0',
      };
    }

    const path = this.fixPath(data.path, srcToken, destToken);
    const { fee, feeFactor, factory } = data;
    const initCode = prependWithOx(data.initCode);
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

  getSimpleParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapV2ForkData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const swapParams = (() => {
      if (isUniswapV2ForkDataNew(data)) {
        const pools = encodePools(data.pools);
        return [pools, data.weth];
      }

      const path = this.fixPath(data.path, src, dest);
      return [srcAmount, destAmount, path];
    })();

    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      side === SwapSide.SELL ? UniswapV2Functions.swap : UniswapV2Functions.buy,
      swapParams,
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
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapV2ForkData,
    side: SwapSide,
  ): TxInfo<UniswapForkParam> {
    const [swapFunction, swapParams] = ((): [
      UniswapV2Functions,
      UniswapForkParam,
    ] => {
      if (isUniswapV2ForkDataNew(data)) {
        const pools = encodePools(data.pools);

        return [
          side === SwapSide.SELL
            ? UniswapV2Functions.swapOnUniswapV2Fork
            : UniswapV2Functions.buyOnUniswapV2Fork,
          [src, dest, srcAmount, destAmount, data.weth, pools],
        ];
      }

      const path = this.fixPath(data.path, src, dest);

      return [
        side === SwapSide.SELL
          ? UniswapV2Functions.swapOnUniswapFork
          : UniswapV2Functions.buyOnUniswapFork,
        [data.factory, data.initCode, srcAmount, destAmount, path],
      ];
    })();

    const encoder = (...params: UniswapForkParam) =>
      this.routerInterface.encodeFunctionData(swapFunction, params);

    return {
      params: swapParams,
      encoder,
      networkFee: '0',
    };
  }

  static getDirectFunctionName(): string[] {
    return this.directFunctionName;
  }
}
