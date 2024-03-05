import { Network, SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { IDexHelper } from '../dex-helper';
import {
  getLocalDeadlineAsFriendlyPlaceholder,
  SimpleExchange,
} from './simple-exchange';
import { NumberAsString } from '@paraswap/core';
import { AsyncOrSync } from 'ts-essentials';
import { Interface, JsonFragment } from '@ethersproject/abi';
import TraderJoeV21RouterABI from '../abi/E3Router.json';

/*
 * E3 was the first fork of TraderJoe v2.1
 * It inherits all the attributes, interfaces and functions of TJv21
 * Additionally, it expands it to make it compatible with Solidly-style revenue sharing,
 * as well as a slightly altered core which makes it a little bit more gas efficient.
 * Such added functions do not impact how Swaps or Liquidity are made.
 * Thus, it can directly re-use existing TraderJoe v2.1 adapters implementation here.
 * The Router input tuple param "VERSION" remains the same `2` as is with TJ v2.1.
 * For backwards compatibility, E3 has placeholder forks of TJv2 and TJv1 in place onchain.
 **/

const E3_ROUTER_ADDRESS: { [network: number]: Address } = {
  [Network.ARBITRUM]: '0xB9A64ab6b91F5c7a78c2360CfF759dE8a8a450d5',
  [Network.BASE]: '0xB9A64ab6b91F5c7a78c2360CfF759dE8a8a450d5',
  [Network.FANTOM]: '0xB9A64ab6b91F5c7a78c2360CfF759dE8a8a450d5',
};

type RouterPath = [
  pairBinSteps: NumberAsString[],
  versions: NumberAsString[],
  tokenPath: Address[],
];
type TraderJoeV2RouterSellParams = [
  _amountIn: NumberAsString,
  _amountOutMin: NumberAsString,
  _routerPath: RouterPath,
  to: Address,
  _deadline: string,
];

type TraderJoeV2RouterBuyParams = [
  _amountOut: NumberAsString,
  _amountInMax: NumberAsString,
  _routerPath: RouterPath,
  to: Address,
  _deadline: string,
];

type TraderJoeV2RouterParam =
  | TraderJoeV2RouterSellParams
  | TraderJoeV2RouterBuyParams;

export type TraderJoeV2Data = {
  tokenIn: string; // redundant
  tokenOut: string; // redundant
  binStep: string;
};

enum TraderJoeV2RouterFunctions {
  swapExactTokensForTokens = 'swapExactTokensForTokens',
  swapTokensForExactTokens = 'swapTokensForExactTokens',
}
export class E3
  extends SimpleExchange
  implements IDexTxBuilder<TraderJoeV2Data, TraderJoeV2RouterParam>
{
  static dexKeys = ['e3'];
  protected routerAddress: string;
  exchangeRouterInterface: Interface;
  needWrapNative = true;

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'e3');

    this.routerAddress = E3_ROUTER_ADDRESS[dexHelper.config.data.network];

    this.exchangeRouterInterface = new Interface(
      TraderJoeV21RouterABI as JsonFragment[],
    );
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: TraderJoeV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    let payload = this.abiCoder.encodeParameters(
      ['tuple(tuple(uint256[],uint8[],address[]),uint256)'],
      [
        [
          [
            [
              data.binStep, // _pairBinSteps: uint256[]
            ],
            [
              2, // _versions: uint8[]
            ],
            [
              data.tokenIn,
              data.tokenOut, // _tokenPath: address[]
            ],
          ],
          getLocalDeadlineAsFriendlyPlaceholder(), // _deadline: uint256
        ],
      ],
    );

    return {
      targetExchange: this.routerAddress,
      payload,
      networkFee: '0',
    };
  }

  getSimpleParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: TraderJoeV2Data,
    side: SwapSide,
  ): AsyncOrSync<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? TraderJoeV2RouterFunctions.swapExactTokensForTokens
        : TraderJoeV2RouterFunctions.swapTokensForExactTokens;

    const swapFunctionParams: TraderJoeV2RouterParam =
      side === SwapSide.SELL
        ? [
            srcAmount,
            destAmount,
            [[data.binStep], ['2'], [srcToken, destToken]],
            this.augustusAddress,
            getLocalDeadlineAsFriendlyPlaceholder(),
          ]
        : [
            destAmount,
            srcAmount,
            [[data.binStep], ['2'], [srcToken, destToken]],
            this.augustusAddress,
            getLocalDeadlineAsFriendlyPlaceholder(),
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
      this.routerAddress,
    );
  }
}
