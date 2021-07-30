import { Interface } from '@ethersproject/abi';
import { AbiCoder } from 'web3-eth-abi';
import { Address, SimpleExchangeParam, NumberAsString } from '../types';
import { ETHER_ADDRESS } from '../constants';
import SimpleSwapHelperABI from '../abi/SimpleSwapHelperRouter.json';

export class SimpleExchange {
  simpleSwapHelper: Interface;
  protected dexKey: string[] = [];
  protected abiCoder: AbiCoder;

  constructor(protected augustusAddress: Address) {
    this.simpleSwapHelper = new Interface(SimpleSwapHelperABI);
    this.abiCoder = new AbiCoder();
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
        networkFee: '0'
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
      networkFee: '0'
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
      networkFee,
    };
  }
  
  getDEXKey(): string[] {
    return this.dexKey.map(d => d.toLowerCase());
  }
}
