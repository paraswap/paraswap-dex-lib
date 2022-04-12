import { Interface, JsonFragment } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import AvadexV3RouterABI from '../abi/AvadexV3Router.json';
import { NumberAsString } from 'paraswap-core';

const AVADEX_V3_ROUTER_ADDRESSES: { [network: number]: Address } = {
  43114: '0x787Bd59120fb81f8BE4AD34280a621877516fe37',
};

export type AvadexV3Data = {
  // ExactInputSingleParams
  fee: number;
  deadline?: number;
  sqrtPriceLimitX96?: NumberAsString;
};

type AvadexV3SellParam = {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  deadline: number;
  amountIn: NumberAsString;
  amountOutMinimum: NumberAsString;
  sqrtPriceLimitX96: NumberAsString;
};

type AvadexV3BuyParam = {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  recipient: Address;
  deadline: number;
  amountOut: NumberAsString;
  amountInMaximum: NumberAsString;
  sqrtPriceLimitX96: NumberAsString;
};

type AvadexV3Param = AvadexV3SellParam | AvadexV3BuyParam;

enum AvadexV3Functions {
  exactInputSingle = 'exactInputSingle',
  exactOutputSingle = 'exactOutputSingle',
}

export class AvadexV3
  extends SimpleExchange
  implements IDexTxBuilder<AvadexV3Data, AvadexV3Param>
{
  static dexKeys = ['avadexv3'];
  exchangeRouterInterface: Interface;
  needWrapNative = true;

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
    this.exchangeRouterInterface = new Interface(
      AvadexV3RouterABI as JsonFragment[],
    );
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AvadexV3Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { fee, deadline, sqrtPriceLimitX96 } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          fee: 'uint24',
          deadline: 'uint256',
          sqrtPriceLimitX96: 'uint160',
        },
      },
      {
        fee,
        deadline: deadline || this.getDeadline(),
        sqrtPriceLimitX96: sqrtPriceLimitX96 || 0,
      },
    );

    return {
      targetExchange: AVADEX_V3_ROUTER_ADDRESSES[this.network], // warning
      payload,
      networkFee: '0', // warning
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: AvadexV3Data,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? AvadexV3Functions.exactInputSingle
        : AvadexV3Functions.exactOutputSingle;
    const swapFunctionParams: AvadexV3Param =
      side === SwapSide.SELL
        ? {
            tokenIn: srcToken,
            tokenOut: destToken,
            fee: data.fee,
            recipient: this.augustusAddress,
            deadline: data.deadline || this.getDeadline(),
            amountIn: srcAmount,
            amountOutMinimum: destAmount,
            sqrtPriceLimitX96: data.sqrtPriceLimitX96 || '0',
          }
        : {
            tokenIn: srcToken,
            tokenOut: destToken,
            fee: data.fee,
            recipient: this.augustusAddress,
            deadline: data.deadline || this.getDeadline(),
            amountOut: destAmount,
            amountInMaximum: srcAmount,
            sqrtPriceLimitX96: data.sqrtPriceLimitX96 || '0',
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
      AVADEX_V3_ROUTER_ADDRESSES[this.network], // warning
    );
  }
}
