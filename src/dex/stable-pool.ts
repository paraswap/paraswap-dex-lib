import { Interface } from '@ethersproject/abi';
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
import StablePoolABI from '../abi/StablePool.json';
import Web3 from 'web3';
import { IDexHelper } from '../dex-helper';

type StablePoolData = {
  exchange: string;
  i: string;
  j: string;
  deadline: string;
};

type StablePoolParam = [
  i: NumberAsString,
  j: NumberAsString,
  dx: NumberAsString,
  min_dy: NumberAsString,
  deadline?: string,
];

enum StabePoolFunctions {
  swap = 'swap',
}

export class StablePool
  extends SimpleExchange
  implements IDexTxBuilder<StablePoolData, StablePoolParam>
{
  static dexKeys = [
    'nerve',
    'saddle',
    'ironv2',
    'snowball',
    'axial, zyberswap',
  ];
  exchangeRouterInterface: Interface;
  minConversionRate = '1';

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'stablePool');
    this.exchangeRouterInterface = new Interface(StablePoolABI);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: StablePoolData,
    side: SwapSide,
  ): AdapterExchangeParam {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { i, j, deadline } = data;
    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          i: 'int128',
          j: 'int128',
          deadline: 'uint256',
        },
      },
      { i, j, deadline },
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
    data: StablePoolData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    if (side === SwapSide.BUY) throw new Error(`Buy not supported`);

    const { exchange, i, j, deadline } = data;
    const swapFunctionParams: StablePoolParam = [
      i,
      j,
      srcAmount,
      this.minConversionRate,
      deadline,
    ];
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      StabePoolFunctions.swap,
      swapFunctionParams,
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
