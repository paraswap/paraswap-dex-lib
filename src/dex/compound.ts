import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import Ceth from '../abi/Compound_CETH.json'; // CETH abi
import Erc20 from '../abi/erc20.json';
import { isETHAddress } from '../utils';

export type CompoundData = {
  fromCToken: boolean;
};
type CompoundParam = [srcAmount: string];
enum CompoundFunctions {
  redeem = 'redeem',
  mint = 'mint',
}

export class Compound
  extends SimpleExchange
  implements IDex<CompoundData, CompoundParam>
{
  protected dexKeys = ['compound'];
  cethInterface: Interface;
  erc20Interface: Interface;

  constructor(augustusAddress: Address, private network: number) {
    super(augustusAddress);
    this.cethInterface = new Interface(Ceth as JsonFragment[]);
    this.erc20Interface = new Interface(Erc20 as JsonFragment[]);
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CompoundData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const cToken = data.fromCToken ? srcToken : destToken; // Warning

    const payload = this.abiCoder.encodeParameter(
      {
        ParentStruct: {
          cToken: 'address',
        },
      },
      { cToken },
    );

    return {
      targetExchange: srcToken, // TODO: find better generalisation, equivalent to LENDING_DEXES
      payload,
      networkFee: '0',
    };
  }

  getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CompoundData,
    side: SwapSide,
  ): SimpleExchangeParam {
    const cToken = data.fromCToken ? srcToken : destToken;
    const value = isETHAddress(srcToken) ? [] : [srcAmount];

    const swapFunctionParams: CompoundParam = [srcAmount];
    const swapData = data.fromCToken
      ? this.cethInterface.encodeFunctionData(
          CompoundFunctions.redeem,
          swapFunctionParams,
        )
      : this.erc20Interface.encodeFunctionData(CompoundFunctions.mint, [value]); // Warning: does passing value work ?

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      cToken,
    );
  }
}
