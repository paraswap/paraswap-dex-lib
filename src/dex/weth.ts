import { Interface } from '@ethersproject/abi';
import ERC20_ABI from '../abi/erc20.json';
import { SwapSide } from '../constants';
import {
  AdapterExchangeParam,
  Address,
  NumberAsString,
  SimpleExchangeParam,
} from '../types';
import { isETHAddress } from '../utils';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';

const addresses: any = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  3: '0xc778417e063141139fce010982780140aa0cd5ab',
  4: '0xc778417e063141139fce010982780140aa0cd5ab',
  42: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  137: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
};

export type WData = {};

export class Weth extends SimpleExchange implements IDex<WData, any> {
  private exchangeRouterInterface: Interface;
  protected dexKeys = ['wmatic', 'weth', 'wbnb'];

  static getAddress(network: number = 1): Address {
    return addresses[network];
  }

  constructor(augustusAddress: Address, protected network: number) {
    super(augustusAddress);
    this.exchangeRouterInterface = new Interface(ERC20_ABI);
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

  getSimpleParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: WData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const address = Weth.getAddress(this.network);

    const swapData = isETHAddress(srcToken)
      ? this.exchangeRouterInterface.encodeFunctionData('deposit')
      : this.exchangeRouterInterface.encodeFunctionData('withdraw', [
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
}
