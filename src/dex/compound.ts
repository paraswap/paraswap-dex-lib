import { Interface, JsonFragment } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SwapSide, NULL_ADDRESS } from '../constants';
import { AdapterExchangeParam, Address, SimpleExchangeParam } from '../types';
import { IDex } from './idex';
import { SimpleExchange } from './simple-exchange';
import Ceth from '../abi/Compound_CETH.json'; // CETH abi
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
  static dexKeys = ['compound'];
  cethInterface: Interface;

  constructor(
    augustusAddress: Address,
    private network: number,
    provider: JsonRpcProvider,
  ) {
    super(augustusAddress, provider);
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
