import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide, NULL_ADDRESS } from '../../constants';
import {
  AdapterExchangeParam,
  Address,
  DexExchangeParam,
  NumberAsString,
  SimpleExchangeParam,
} from '../../types';
import { IDexTxBuilder } from '../idex';
import { SimpleExchange } from '../simple-exchange';
import Ceth from '../../abi/Compound_CETH.json'; // CETH abi
import { isETHAddress } from '../../utils';
import { IDexHelper } from '../../dex-helper';
import { CompoundData, CompoundFunctions, CompoundParam } from './types';

export class Compound
  extends SimpleExchange
  implements IDexTxBuilder<CompoundData, CompoundParam>
{
  static dexKeys = ['compound'];
  cethInterface: Interface;

  constructor(dexHelper: IDexHelper) {
    super(dexHelper, 'compound');
    this.cethInterface = new Interface(Ceth as JsonFragment[]);
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
      // target exchange is not used by the contract
      targetExchange: NULL_ADDRESS,
      payload,
      networkFee: '0',
    };
  }

  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CompoundData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const cToken = data.fromCToken ? srcToken : destToken;
    const swapData = isETHAddress(srcToken)
      ? this.cethInterface.encodeFunctionData(CompoundFunctions.mint)
      : this.erc20Interface.encodeFunctionData(
          data.fromCToken ? CompoundFunctions.redeem : CompoundFunctions.mint,
          [srcAmount],
        );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      cToken,
      undefined,
      undefined,
      undefined,
      data.fromCToken,
    );
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    _destAmount: NumberAsString,
    _recipient: Address,
    data: CompoundData,
    _side: SwapSide,
  ): DexExchangeParam {
    const cToken = data.fromCToken ? srcToken : destToken;
    const swapData = isETHAddress(srcToken)
      ? this.cethInterface.encodeFunctionData(CompoundFunctions.mint)
      : this.erc20Interface.encodeFunctionData(
          data.fromCToken ? CompoundFunctions.redeem : CompoundFunctions.mint,
          [srcAmount],
        );

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: false,
      exchangeData: swapData,
      targetExchange: cToken,
      returnAmountPos: undefined,
      skipApproval: data.fromCToken,
    };
  }
}
