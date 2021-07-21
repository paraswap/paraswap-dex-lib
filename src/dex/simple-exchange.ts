import { Interface } from '@ethersproject/abi';
import { Address, SimpleExchangeParam, NumberAsString } from '../types';
import { ETHER_ADDRESS } from '../constants';
import * as SimpleSwapHelperABI from '../abi/SimpleSwapHelperRouter.json';

export class SimpleExchange {
  network: number;
  simpleSwapHelper: Interface;
  constructor(protected augustusAddress: Address) {
    this.simpleSwapHelper = new Interface(SimpleSwapHelperABI);
  }

  protected getApproveSimpleParam(
    token: Address,
    target: Address,
    amount: string,
  ): SimpleExchangeParam {
    // TODO: add logic to check if allowance is needed
    if (token.toLowerCase() === ETHER_ADDRESS.toLowerCase()) {
      return {
        callees: [],
        calldata: [],
        values: [],
      };
    }

    const approveCalldata = this.simpleSwapHelper.encodeFunctionData(
      'approve',
      [token, target, amount],
    );

    return {
      callees: [this.augustusAddress],
      calldata: [approveCalldata],
      values: ['0'],
    };
  }

  protected buildSimpleParamWithoutWETHConversion(
    src: Address,
    srcAmount: NumberAsString,
    dest: Address,
    destAmount: NumberAsString,
    swapCallData: string,
    swapCallee: Address,
    networkFee: NumberAsString = '0',
  ): SimpleExchangeParam {
    const approveParam = this.getApproveSimpleParam(src, swapCallee, srcAmount);
    const swapValue = (
      BigInt(networkFee) +
      BigInt(
        src.toLowerCase() === ETHER_ADDRESS.toLowerCase() ? srcAmount : '0',
      )
    ).toString();

    return {
      callees: [...approveParam.callees, swapCallee],
      calldata: [...approveParam.calldata, swapCallData],
      values: [...approveParam.values, swapValue],
    };
  }
}
