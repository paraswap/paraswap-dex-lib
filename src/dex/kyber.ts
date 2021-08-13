import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import KyberABI from '../abi/KyberProxy.json';
import { NumberAsString } from 'paraswap-core';

const MAX_DEST_AMOUNT =
  '57896044618658097711785492504343953926634992332820282019728792003956564819968';
const KYBER_FEE_WALLET = '0x52262274dF4dB2586407F95454dea18eC1153662';

export type KyberData = {
  exchange: Address;
  minConversionRate: string;
  maxDestAmount?: string;
  hint: string;
};
type KyberParam = [
  src: NumberAsString,
  srcAmount: NumberAsString,
  dest: NumberAsString,
  destAddress: Address,
  maxDestAmount: NumberAsString,
  minConversionRate: NumberAsString,
  platformWallet: Address,
  platformFeeBps: NumberAsString,
  hint: string,
];
enum KyberFunctions {
  tradeWithHintAndFee = 'tradeWithHintAndFee',
}

export class Kyber
  extends SimpleExchange
  implements IDex<KyberData, KyberParam>
{
  static dexKeys = ['kyber'];
  exchangeRouterInterface: Interface;

  constructor(augustusAddress: Address, private network: number) {
    super(augustusAddress);
    this.exchangeRouterInterface = new Interface(KyberABI as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: KyberData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { hint } = data;
    const minConversionRateForBuy = 1;

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          minConversionRateForBuy: 'uint256',
          hint: 'bytes',
        },
      },
      { minConversionRateForBuy, hint },
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
    data: KyberData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const minConversionRate = '1';
    const platformFeeBps = '0';
    const swapFunction = KyberFunctions.tradeWithHintAndFee;
    const maxDestAmount = data.maxDestAmount || MAX_DEST_AMOUNT;
    const swapFunctionParams: KyberParam = [
      srcToken,
      srcAmount,
      destToken,
      this.augustusAddress,
      maxDestAmount,
      minConversionRate,
      KYBER_FEE_WALLET,
      platformFeeBps,
      data.hint,
    ];
    const swapData = this.exchangeRouterInterface.encodeFunctionData(
      swapFunction,
      swapFunctionParams,
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.exchange,
    );
  }
}
