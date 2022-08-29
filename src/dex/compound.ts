import { Interface, JsonFragment } from '@ethersproject/abi';
import { SwapSide, NULL_ADDRESS } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDexTxBuilder } from './idex';
import { SimpleExchange } from './simple-exchange';
import Ceth from '../abi/Compound_CETH.json'; // CETH abi
import { isETHAddress } from '../utils';
import Web3 from 'web3';
import { IDexHelper } from '../dex-helper';

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
  implements IDexTxBuilder<CompoundData, CompoundParam>
{
  static dexKeys = ['compound'];
  cethInterface: Interface;

  constructor(dexHelper: IDexHelper, dexKey: string) {
    super(dexHelper, dexKey);
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
    );
  }
}
