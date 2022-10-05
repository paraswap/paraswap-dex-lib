import { Interface, JsonFragment } from '@ethersproject/abi';
import { Provider } from '@ethersproject/providers';
import { SwapSide } from '../constants';
import {
  AdapterExchangeParam,
  Address,
  NumberAsString,
  SimpleExchangeParam,
} from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import CurveV2ABI from '../abi/CurveV2.json';
import type { CurveV1Data } from './curve-v1/types';
import Web3 from 'web3';

type CurveV2Data = Omit<CurveV1Data, 'deadline' | 'v3'>;

type CurveV2Param = [
  i: NumberAsString,
  j: NumberAsString,
  dx: NumberAsString,
  min_dy: NumberAsString,
  ethDeposit?: boolean,
];

enum CurveSwapFunctions {
  exchange = 'exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy)',
  exchange_underlying = 'exchange_underlying(uint256 i, uint256 j, uint256 dx, uint256 minDy)',
}

export class CurveV2
  extends SimpleExchange
  implements IDexTxBuilder<CurveV2Data, CurveV2Param>
{
  static dexKeys = ['curvev2'];
  exchangeRouterInterface: Interface;
  minConversionRate = '1';
  needWrapNative = true;

  constructor(
    augustusAddress: Address,
    public network: number,
    provider: Web3,
  ) {
    super(augustusAddress, provider);
    this.exchangeRouterInterface = new Interface(CurveV2ABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { i, j, underlyingSwap } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          i: 'uint256',
          j: 'uint256',
          underlyingSwap: 'bool',
        },
      },
      { i, j, underlyingSwap },
    );

    return {
      targetExchange: data.exchange,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveV2Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { exchange, i, j, underlyingSwap } = data;
    const args: CurveV2Param = [
      i.toString(),
      j.toString(),
      srcAmount,
      this.minConversionRate,
    ];
    const swapMethod = underlyingSwap
      ? CurveSwapFunctions.exchange_underlying
      : CurveSwapFunctions.exchange;
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapMethod,
      args,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }
}
