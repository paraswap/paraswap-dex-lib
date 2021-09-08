import { Interface, JsonFragment } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { NumberAsString, SwapSide } from 'paraswap-core';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import ERC20 from '../abi/erc20.json';
import { isETHAddress } from '../utils';

export const WETHAddresses: any = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  3: '0xc778417e063141139fce010982780140aa0cd5ab',
  4: '0xc778417e063141139fce010982780140aa0cd5ab',
  42: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  137: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  43114: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
};

export enum WethFunctions {
  withdrawAllWETH = 'withdrawAllWETH',
  deposit = 'deposit',
  withdraw = 'withdraw',
}

type DepositWithdrawReturn = {
  opType: WethFunctions;
  callee: string;
  calldata: string;
  value: string;
};
export interface IWethDepositorWithdrawer {
  getDepositWithdrawParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    side: SwapSide,
  ): DepositWithdrawReturn | undefined;
}

export type WData = {};

export class Weth
  extends SimpleExchange
  implements IDex<WData, any>, IWethDepositorWithdrawer
{
  static dexKeys = ['wmatic', 'weth', 'wbnb', 'wavax'];
  erc20Interface: Interface;

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
    this.erc20Interface = new Interface(ERC20 as JsonFragment[]);
  }

  static getAddress(network: number = 1): Address {
    return WETHAddresses[network];
  }

  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: WData,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: Weth.getAddress(this.network),
      payload: '0x',
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: WData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const address = Weth.getAddress(this.network);

    const swapData = isETHAddress(srcToken)
      ? this.erc20Interface.encodeFunctionData(WethFunctions.deposit)
      : this.erc20Interface.encodeFunctionData(WethFunctions.withdraw, [
          srcAmount,
        ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      address,
    );
  }

  getDepositWithdrawParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    side: SwapSide,
  ): DepositWithdrawReturn | undefined {
    const wethToken = Weth.getAddress(this.network);

    if (srcAmount !== '0' && isETHAddress(srcToken)) {
      const opType = WethFunctions.deposit;
      const depositWethData = this.erc20Interface.encodeFunctionData(opType);

      return {
        opType,
        callee: wethToken,
        calldata: depositWethData,
        value: srcAmount,
      };
    }

    if (destAmount !== '0' && isETHAddress(destToken)) {
      const opType = WethFunctions.withdrawAllWETH;
      const withdrawWethData = this.simpleSwapHelper.encodeFunctionData(
        opType,
        [wethToken],
      );

      return {
        opType,
        callee: this.augustusAddress,
        calldata: withdrawWethData,
        value: '0',
      };
    }
  }
}
