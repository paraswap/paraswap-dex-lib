import { ContractMethodEncoder, OptimalRate, Address, TxInfo } from '../types';

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
  ): TxInfo<RouterParam>;

  getContractMethodName(): string;
}
