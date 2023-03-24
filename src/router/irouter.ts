import { ContractMethodEncoder, OptimalRate, Address, TxInfo } from '../types';
import { AsyncOrSync } from 'ts-essentials';

export interface IRouter<RouterParam> {
  build(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    userAddress: Address,
    referrerAddress: Address | undefined,
    partner: Address,
    partnerFeePercent: string,
    positiveSlippageToUser: boolean,
    beneficiary: Address,
    permit: string,
    deadline: number,
    uuid: string,
  ): AsyncOrSync<TxInfo<RouterParam>>;

  getContractMethodName(): string;
}
