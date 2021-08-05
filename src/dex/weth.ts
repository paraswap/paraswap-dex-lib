import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from 'paraswap-core';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import ERC20 from '../abi/erc20.json';
import { isETHAddress } from '../utils';

const addresses: any = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  3: '0xc778417e063141139fce010982780140aa0cd5ab',
  4: '0xc778417e063141139fce010982780140aa0cd5ab',
  42: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  137: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
};

enum WethFunctions {
  withdrawAllWETH = 'withdrawAllWETH',
  deposit = 'deposit',
}

export class Weth extends SimpleExchange implements IDex<void, void> {
  erc20Interface: Interface;

  constructor(augustusAddress: Address, public network: number) {
    super(augustusAddress);
    this.erc20Interface = new Interface(ERC20 as JsonFragment[]);
  }

  static getAddress(network: number = 1): Address {
    return addresses[network];
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: void,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: '0',
      payload: '0x',
      networkFee: '0',
    };
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: void,
    side: SwapSide,
  ): SimpleExchangeParam {
    const wethToken = Weth.getAddress(this.network);

    if (isETHAddress(srcToken)) {
      const depositWethData = this.erc20Interface.encodeFunctionData(
        WethFunctions.deposit,
      );

      return {
        callees: [wethToken],
        calldata: [depositWethData],
        values: [srcAmount],
        networkFee: '0',
      };
    }

    if (isETHAddress(destToken)) {
      const withdrawWethData = this.simpleSwapHelper.encodeFunctionData(
        WethFunctions.withdrawAllWETH,
        [wethToken],
      );

      return {
        callees: [this.augustusAddress],
        calldata: [withdrawWethData],
        values: ['0'],
        networkFee: '0',
      };
    }

    return {
      callees: [],
      calldata: [],
      values: [],
      networkFee: '0',
    };
  }
}
