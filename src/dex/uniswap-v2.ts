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
import { prependWithOx } from '../utils';

const UniswapV2AliasKeys = [
  'uniswapv2',
  'quickswap',
  'pancakeswap',
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

type UniswapDataLegacy = {
  router: Address;
  path: Address[];
  factory: Address;
  initCode: string;
  fee: number[];
  feeFactor: number;
};

type UniswapData = {
  router: Address;
  pools: UniswapPool[];
  weth: Address;
};

enum UniswapV2Functions {
  swap = 'swap',
  buy = 'buy',
  swapOnUniswap = 'swapOnUniswap',
  buyOnUniswap = 'buyOnUniswap',
  swapOnUniswapFork = 'swapOnUniswapFork',
  buyOnUniswapFork = 'buyOnUniswapFork',
  swapOnUniswapV2Fork = 'swapOnUniswapV2Fork',
  buyOnUniswapV2Fork = 'buyOnUniswapV2Fork',
}

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
type UniswapParam =
  | SwapOnUniswapParam
  | BuyOnUniswapParam
  | SwapOnUniswapForkParam
  | BuyOnUniswapForkParam;

const directUniswapFunctionName = [
  UniswapV2Functions.swapOnUniswap,
  UniswapV2Functions.buyOnUniswap,
  UniswapV2Functions.swapOnUniswapFork,
  UniswapV2Functions.buyOnUniswapFork,
];

type UniswapPool = {
  address: Address;
  direction: boolean;
  fee: number;
};

function encodePools(pools: UniswapPool[]): NumberAsString[] {
  return pools.map(({ fee, direction, address }) => {
    return (
      (BigInt(10000 - fee) << BigInt(161)) +
      (BigInt(direction ? 0 : 1) << BigInt(160)) +
      BigInt(address)
    ).toString();
  });
}

export class UniswapV2
  extends SimpleExchange
  implements IDex<UniswapData, UniswapParam>
{
  routerInterface: Interface;
  exchangeRouterInterface: Interface;
  static dexKeys = UniswapV2AliasKeys;
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
    data: UniswapData,
    side: SwapSide,
  ): AdapterExchangeParam {
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

  getSimpleParam(
    src: Address,
    dest: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: UniswapData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const pools = encodePools(data.pools);

    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      side === SwapSide.SELL ? UniswapV2Functions.swap : UniswapV2Functions.buy,
      [src, srcAmount, destAmount, data.weth, pools],
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

  // TODO: Move to new uniswapv2&forks router interface
  getDirectParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    _data: UniswapData,
    side: SwapSide,
    contractMethod?: string,
  ): TxInfo<UniswapParam> {
    if (!contractMethod) throw `contractMethod need to be passed`;

    const data = _data as unknown as UniswapDataLegacy;

    const swapParams = ((): UniswapParam => {
      const path = this.fixPath(data.path, srcToken, destToken);

      switch (contractMethod) {
        case UniswapV2Functions.swapOnUniswap:
        case UniswapV2Functions.buyOnUniswap:
          return [srcAmount, destAmount, path];

        case UniswapV2Functions.swapOnUniswapFork:
        case UniswapV2Functions.buyOnUniswapFork:
          return [
            data.factory,
            prependWithOx(data.initCode),
            srcAmount,
            destAmount,
            path,
          ];

        default:
          throw `contractMethod=${contractMethod} is not supported`;
      }
    })();

    const encoder = (...params: UniswapParam) =>
      this.routerInterface.encodeFunctionData(contractMethod, params);
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
