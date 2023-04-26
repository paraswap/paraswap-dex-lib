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
import TraderJoeV2RouterABI from '../abi/TraderJoeV2Router.json';

const TRADERJOE_V2_ROUTER_ADDRESS: { [network: number]: Address } = {
  [Network.AVALANCHE]: '0xE3Ffc583dC176575eEA7FD9dF2A7c65F7E23f4C3',
  [Network.ARBITRUM]: '0x7BFd7192E76D950832c77BB412aaE841049D8D9B',
  [Network.BSC]: '0xb66A2704a0dabC1660941628BE987B4418f7a9E8',
};

type TraderJoeV2RouterSellParams = [
  _amountIn: NumberAsString,
  _amountOutMin: NumberAsString,
  _pairBinSteps: NumberAsString[],
  _tokenPath: Address[],
  to: Address,
  _deadline: number,
];

type TraderJoeV2RouterBuyParams = [
  _amountOut: NumberAsString,
  _amountInMax: NumberAsString,
  _pairBinSteps: NumberAsString[],
  _tokenPath: Address[],
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

export class TraderJoeV2
  extends SimpleExchange
  implements IDexTxBuilder<TraderJoeV2Data, TraderJoeV2RouterParam>
{
  static dexKeys = ['traderjoev2'];
  protected routerAddress: string;
  exchangeRouterInterface: Interface;
  needWrapNative = true;

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'traderjoev2');

    this.routerAddress =
      TRADERJOE_V2_ROUTER_ADDRESS[dexHelper.config.data.network];

    this.exchangeRouterInterface = new Interface(
      TraderJoeV2RouterABI as JsonFragment[],
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
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          _pairBinSteps: 'uint256[]',
          _tokenPath: 'address[]',
          _deadline: 'uint256',
        },
      },
      {
        _pairBinSteps: [data.binStep],
        _tokenPath: [data.tokenIn, data.tokenOut], // FIXME: redundant, shoot & read from contract
        _deadline: getLocalDeadlineAsFriendlyPlaceholder(), // FIXME: more gas efficient to pass block.timestamp in adapter
      },
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
            [data.binStep],
            [srcToken, destToken],
            this.augustusAddress,
            getLocalDeadlineAsFriendlyPlaceholder(),
          ]
        : [
            destAmount,
            srcAmount,
            [data.binStep],
            [srcToken, destToken],
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
