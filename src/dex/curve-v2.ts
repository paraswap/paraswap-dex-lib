import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import {
  AdapterExchangeParam,
  Address,
  NumberAsString,
  SimpleExchangeParam,
} from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import CurveV2ABI from '../abi/CurveV2.json';
import { BUY_NOT_SUPPORTED_ERRROR } from '../constants';
import { isETHAddress } from '../utils';
import type { CurveData } from './curve';

type CurveV2Data = Omit<CurveData, 'deadline' | 'v3'>;

type CurveV2Param = [
  i: NumberAsString,
  j: NumberAsString,
  dx: NumberAsString,
  min_dy: NumberAsString,
  ethDeposit?: boolean,
];

enum CurveSwapFunctions {
  exchange = 'exchange',
  exchange_underlying = 'exchange_underlying',
}

export class CurveV2
  extends SimpleExchange
  implements IDex<CurveV2Data, CurveV2Param>
{
  protected dexKeys = ['curvev2'];
  exchangeRouterInterface: Interface;
  minConversionRate = '1';

  constructor(augustusAddress: Address) {
    super(augustusAddress);
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
    if (side === SwapSide.BUY) throw BUY_NOT_SUPPORTED_ERRROR;

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

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CurveV2Data,
    side: SwapSide,
  ): SimpleExchangeParam {
    if (side === SwapSide.BUY) throw BUY_NOT_SUPPORTED_ERRROR;

    const { exchange, i, j, underlyingSwap } = data;
    const defaultArgs: CurveV2Param = [i, j, srcAmount, this.minConversionRate];
    // Only non underlyingSwaps in mainnet have an option to directly deposit ETH
    if (!underlyingSwap && isETHAddress(srcToken)) defaultArgs.push(true);
    const swapMethod = underlyingSwap
      ? CurveSwapFunctions.exchange_underlying
      : CurveSwapFunctions.exchange;
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapMethod,
      defaultArgs,
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
