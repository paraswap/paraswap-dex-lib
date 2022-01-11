import { Interface } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import Web3Abi, { AbiCoder } from 'web3-eth-abi';
import { Address, SimpleExchangeParam, NumberAsString } from '../types';
import { ETHER_ADDRESS } from '../constants';
import SimpleSwapHelperABI from '../abi/SimpleSwapHelperRouter.json';
import ERC20ABI from '../abi/erc20.json';
import { isETHAddress } from '../utils';
import { MAX_UINT, NULL_ADDRESS } from '../constants';

export class SimpleExchange {
  simpleSwapHelper: Interface;
  protected abiCoder: AbiCoder;
  erc20Interface: Interface;
  needWrapNative = false;

  constructor(
    protected augustusAddress: Address,
    private provider: JsonRpcProvider,
  ) {
    this.simpleSwapHelper = new Interface(SimpleSwapHelperABI);
    this.erc20Interface = new Interface(ERC20ABI);
    this.abiCoder = Web3Abi as unknown as AbiCoder;
  }

  private async hasAugustusAllowance(
    token: Address,
    target: Address,
    amount: string,
  ): Promise<boolean> {
    if (token.toLowerCase() === ETHER_ADDRESS.toLowerCase()) return true;

    const allowanceData = this.erc20Interface.encodeFunctionData('allowance', [
      this.augustusAddress,
      target,
    ]);
    const allowanceRaw = await this.provider.call({
      to: token,
      data: allowanceData,
    });
    const allowance = this.erc20Interface.decodeFunctionResult(
      'allowance',
      allowanceRaw,
    );
    return BigInt(allowance.toString()) >= BigInt(amount);
  }

  protected async getApproveSimpleParam(
    token: Address,
    target: Address,
    amount: string,
  ): Promise<SimpleExchangeParam> {
    const hasAllowance = await this.hasAugustusAllowance(token, target, amount);
    if (hasAllowance) {
      return {
        callees: [],
        calldata: [],
        values: [],
        networkFee: '0',
      };
    }

    const approveCalldata = this.simpleSwapHelper.encodeFunctionData(
      'approve',
      [token, target, MAX_UINT],
    );

    return {
      callees: [this.augustusAddress],
      calldata: [approveCalldata],
      values: ['0'],
      networkFee: '0',
    };
  }

  protected async buildSimpleParamWithoutWETHConversion(
    src: Address,
    srcAmount: NumberAsString,
    dest: Address,
    destAmount: NumberAsString,
    swapCallData: string,
    swapCallee: Address,
    spender?: Address,
    networkFee: NumberAsString = '0',
  ): Promise<SimpleExchangeParam> {
    const approveParam = await this.getApproveSimpleParam(
      src,
      spender || swapCallee,
      srcAmount,
    );
    const swapValue = (
      BigInt(networkFee) + BigInt(isETHAddress(src) ? srcAmount : '0')
    ).toString();

    return {
      callees: [...approveParam.callees, swapCallee],
      calldata: [...approveParam.calldata, swapCallData],
      values: [...approveParam.values, swapValue],
      networkFee,
    };
  }

  getDeadline() {
    return Math.floor(new Date().getTime() / 1000) + 60 * 60;
  }
}
