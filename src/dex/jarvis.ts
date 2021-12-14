import { Interface, JsonFragment } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { NULL_ADDRESS, SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import JarvisABI from '../abi/Jarvis.json';

const THIRTY_MINUTES = 60 * 30;

export type JarvisData = {
  derivatives: string;
  destDerivatives?: string;
  pools: string[];
  fee: string;
  method: JarvisFunctions;
  router: Address;
};

type JarvisMintParam = [
  derivative: string,
  minNumTokens: string,
  collateralAmount: string,
  feePercentage: string,
  expiration: string,
  recipient: string,
];

type JarvisRedeemParam = [
  derivative: string,
  numTokens: string,
  minCollateral: string,
  feePercentage: string,
  expiration: string,
  recipient: string,
];

type JarvisExchangeParam = [
  derivative: string,
  destPool: string,
  destDerivative: string,
  numTokens: string,
  minDestNumTokens: string,
  feePercentage: string,
  expiration: string,
  recipient: string,
];

type JarvisParam = JarvisExchangeParam | JarvisMintParam | JarvisRedeemParam;

enum JarvisFunctions {
  mint = 'mint',
  redeem = 'redeem',
  exchange = 'exchange',
}

export class Jarvis
  extends SimpleExchange
  implements IDex<JarvisData, JarvisParam>
{
  static dexKeys = ['jarvis'];
  poolInterface: Interface;
  needWrapNative = false;

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
    this.poolInterface = new Interface(JarvisABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: JarvisData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { method } = data;
    const type = [
      JarvisFunctions.mint,
      JarvisFunctions.redeem,
      JarvisFunctions.exchange,
    ].indexOf(method);

    if (type === undefined) {
      throw new Error(
        `Jarvis: Invalid OpType ${method}, Should be one of ['mint', 'exchange', 'redeem']`,
      );
    }

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          opType: 'uint',
          derivatives: 'address',
          destDerivatives: 'address',
          fee: 'uint128',
          destPool: 'address',
          expiration: 'uint128',
        },
      },
      {
        opType: type,
        derivatives: data.derivatives,
        destDerivatives: data.destDerivatives || NULL_ADDRESS,
        fee: data.fee,
        destPool: data.pools[1] || NULL_ADDRESS,
        expiration: (Date.now() / 1000 + THIRTY_MINUTES).toFixed(0),
      },
    );

    return {
      targetExchange: data.pools[0],
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: JarvisData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction = data.method;
    const timestamp = (Date.now() / 1000 + THIRTY_MINUTES).toFixed(0);
    let swapFunctionParams: JarvisParam;
    switch (swapFunction) {
      case JarvisFunctions.mint:
        swapFunctionParams = [
          data.derivatives,
          destAmount,
          srcAmount,
          data.fee,
          timestamp,
          this.augustusAddress,
        ];
        break;
      case JarvisFunctions.redeem:
        swapFunctionParams = [
          data.derivatives,
          srcAmount,
          destAmount,
          data.fee,
          timestamp,
          this.augustusAddress,
        ];
        break;
      case JarvisFunctions.exchange:
        swapFunctionParams = [
          data.derivatives,
          data.pools[1],
          data.destDerivatives!,
          srcAmount,
          destAmount,
          data.fee,
          timestamp,
          this.augustusAddress,
        ];
        break;
      default:
        throw new Error(`Unknown function ${swapFunction}`);
    }

    const swapData = this.poolInterface.encodeFunctionData(swapFunction, [
      swapFunctionParams,
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.pools[0],
    );
  }
}
