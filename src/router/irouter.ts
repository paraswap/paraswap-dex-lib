import { ContractMethodEncoder, OptimalRate, Address, TxInfo } from '../types';

export interface IRouter<RouterParam> {
  build(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    userAddress: Address,
    partner: Address,
    feePercent: string,
    beneficiary: Address,
    permit: string,
    deadline: string,
  ): TxInfo<RouterParam>;

  getContractMethodName(): string;
}

export type RouterMap = { [contractMethod: string]: IRouter<any> };
