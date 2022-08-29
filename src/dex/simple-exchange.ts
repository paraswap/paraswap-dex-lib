import { Interface } from '@ethersproject/abi';
import Web3Abi, { AbiCoder } from 'web3-eth-abi';
import { Address, SimpleExchangeParam, NumberAsString } from '../types';
import { CACHE_PREFIX, ETHER_ADDRESS } from '../constants';
import SimpleSwapHelperABI from '../abi/SimpleSwapHelperRouter.json';
import ERC20ABI from '../abi/erc20.json';
import { isETHAddress } from '../utils';
import { MAX_UINT } from '../constants';
import Web3 from 'web3';
import { IDexHelper } from '../dex-helper';

export class SimpleExchange {
  simpleSwapHelper: Interface;
  protected abiCoder: AbiCoder;
  erc20Interface: Interface;
  needWrapNative = false;

  protected augustusAddress: Address;
  private provider: Web3;

  protected network: number;
  protected dexmapKey: string;
  protected dexKey: string;

  constructor(protected dexHelper: IDexHelper, name: string) {
    this.dexKey = name.toLowerCase();
    this.simpleSwapHelper = new Interface(SimpleSwapHelperABI);
    this.erc20Interface = new Interface(ERC20ABI);
    this.abiCoder = Web3Abi as unknown as AbiCoder;

    this.network = dexHelper.network;
    this.augustusAddress = dexHelper.config.data.augustusAddress;
    this.provider = dexHelper.web3Provider;
    this.dexmapKey = `${CACHE_PREFIX}_${dexHelper.network}_${this.dexKey}_poolconfigs`;
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

    const allowanceRaw = await this.provider.eth.call({
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
      BigInt(networkFee) + (isETHAddress(src) ? BigInt(srcAmount) : 0n)
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
