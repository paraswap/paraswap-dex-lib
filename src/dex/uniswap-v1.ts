import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import UniswapV1ExchangeABI from '../abi/uniswap-v1-exchange.json';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { isETHAddress } from '../utils';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import { NumberAsString } from 'paraswap-core';

export type UniswapV1Data = {
  // ExactInputSingleParams
  pool: string;
};

type UniswapV1Param = [
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  recipient: Address,
  deadline: number,
  amountIn: NumberAsString,
  amountOutMinimum: NumberAsString,
  sqrtPriceLimitX96: NumberAsString,
];

export class UniswapV1
  extends SimpleExchange
  implements IDex<UniswapV1Data, UniswapV1Param>
{
  static dexKeys = ['uniswap'];
  exchangeInterface: Interface;
  needWrapNative = false;

  constructor(augustusAddress: Address, private network: number) {
    super(augustusAddress);
    this.exchangeInterface = new Interface(
      UniswapV1ExchangeABI as JsonFragment[],
    );
  }

  // getAdapterParam(
  //   srcToken: string,
  //   destToken: string,
  //   srcAmount: string,
  //   destAmount: string,
  //   data: UniswapV1Data,
  //   side: SwapSide,
  // ): AdapterExchangeParam {
  //   const { fee, deadline, sqrtPriceLimitX96 } = data;
  //   const payload = this.abiCoder.encodeParameter(
  //     {
  //       ParentStruct: {
  //         fee: 'uint24',
  //         deadline: 'uint256',
  //         sqrtPriceLimitX96: 'uint160',
  //       },
  //     },
  //     {
  //       fee,
  //       deadline: deadline || this.getDeadline(),
  //       sqrtPriceLimitX96: sqrtPriceLimitX96 || 0,
  //     },
  //   );
  //
  //   return {
  //     targetExchange: UNISWAP_V3_ROUTER_ADDRESSES[this.network], // warning
  //     payload,
  //     networkFee: '0', // warning
  //   };
  // }

  private getSwapData(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
  ): string {
    if (isETHAddress(srcToken)) {
      return this.exchangeInterface.encodeFunctionData('ethToTokenSwapInput', [
        destAmount,
        this.getDeadline(),
      ]);
    } else if (isETHAddress(destToken)) {
      return this.exchangeInterface.encodeFunctionData('tokenToEthSwapInput', [
        srcAmount,
        destAmount,
        this.getDeadline(),
      ]);
    } else {
      return this.exchangeInterface.encodeFunctionData(
        'tokenToTokenSwapInput',
        [srcAmount, destAmount, 1, this.getDeadline()],
      );
    }
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: UniswapV1Data,
    side: SwapSide,
  ): SimpleExchangeParam {
    const swapData = this.getSwapData(
      srcToken,
      destToken,
      srcAmount,
      destAmount,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.pool, // warning
    );
  }
}
