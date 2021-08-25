import { ContractMethodEncoder, OptimalRate, Address, TxInfo } from '../types';
import { AsyncOrSync } from 'ts-essentials';

export interface IRouter<RouterParam> {
  build(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    userAddress: Address,
    partner: Address,
    partnerFeePercent: string,
    beneficiary: Address,
    permit: string,
    deadline: string,
  ): AsyncOrSync<TxInfo<RouterParam>>;

  getContractMethodName(): string;
}
