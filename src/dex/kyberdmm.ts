import { Interface, JsonFragment } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import KyberDmmABI from '../abi/kyberdmm.abi.json';

export type KyberDmmData = {
  router: Address;
  path: Address[];
  pools: {
    address: Address;
    direction: boolean;
    fee: number;
  }[];
  factory: Address;
};
type KyberDmmParam = [
  srcAmount: string,
  destToken: string,
  pools: string[],
  path: string[],
  to: string,
  deadline: string,
];

enum KyberDMMFunctions {
  swapExactTokensForTokens = 'swapExactTokensForTokens',
  swapTokensForExactTokens = 'swapTokensForExactTokens',
}

export class KyberDmm
  extends SimpleExchange
  implements IDex<KyberDmmData, KyberDmmParam>
{
  static dexKeys = ['kyberdmm'];
  exchangeRouterInterface: Interface;
  needWrapNative = true;

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
    this.exchangeRouterInterface = new Interface(KyberDmmABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: KyberDmmData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          poolPath: 'address[]',
          path: 'address[]',
        },
      },
      { poolPath: data.pools.map(p => p.address), path: data.path },
    );
    return {
      targetExchange: data.router,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: KyberDmmData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunctionParams: KyberDmmParam = [
      srcAmount,
      destAmount,
      data.pools.map(p => p.address),
      data.path,
      this.augustusAddress,
      Number.MAX_SAFE_INTEGER.toString(),
    ];
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      KyberDMMFunctions.swapExactTokensForTokens,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.router,
    );
  }
}
