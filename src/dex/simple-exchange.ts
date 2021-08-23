import { Interface } from '@ethersproject/abi';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
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
  private erc20: Contract;
  needWrapNative = false;

  constructor(
    protected augustusAddress: Address,
    private provider: JsonRpcProvider,
  ) {
    this.simpleSwapHelper = new Interface(SimpleSwapHelperABI);
    // The contract address is set to null address as the token address is not known upfront
    this.erc20 = new Contract(NULL_ADDRESS, ERC20ABI, provider);
    this.abiCoder = Web3Abi as unknown as AbiCoder;
  }

  private async hasAugustusAllowance(
    token: Address,
    target: Address,
    amount: string,
  ): Promise<boolean> {
    if (token.toLowerCase() === ETHER_ADDRESS.toLowerCase()) return true;

    const tokenContract = this.erc20.attach(token);
    const allowance = await tokenContract.functions.allowance(
      this.augustusAddress,
      target,
    );
    return BigInt(allowance.toString()) >= BigInt(amount);
  }

  protected async getApproveSimpleParam(
    token: Address,
    target: Address,
    amount: string,
  ): Promise<SimpleExchangeParam> {
    // TODO: add logic to check if allowance is needed
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
