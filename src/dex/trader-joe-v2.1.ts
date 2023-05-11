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
import TraderJoeV21RouterABI from '../abi/TraderJoeV21Router.json';

const TRADERJOE_V2_1_ROUTER_ADDRESS: { [network: number]: Address } = {
  [Network.AVALANCHE]: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
  [Network.ARBITRUM]: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
  [Network.BSC]: '0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30',
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
export class TraderJoeV21
  extends SimpleExchange
  implements IDexTxBuilder<TraderJoeV2Data, TraderJoeV2RouterParam>
{
  static dexKeys = ['traderjoev2.1'];
  protected routerAddress: string;
  exchangeRouterInterface: Interface;
  needWrapNative = true;

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'traderjoev2.1');

    this.routerAddress =
      TRADERJOE_V2_1_ROUTER_ADDRESS[dexHelper.config.data.network];

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
      ['tuple(tuple(uint256[],uint8[],address[]),uint256,uint256)'],
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
          destAmount, // _mintOutAmount: uint256
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
