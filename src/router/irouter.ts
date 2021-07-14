import { EncodeContractMethod, OptimalRate, Address } from '../types';
import { DexMap } from '../dex/idex';

export interface IRouter<RouterParam> {
   build(
    priceRoute: OptimalRate,
    minMaxAmount: BigInt,
    userAddress: Address,
    partner: Address,
    receiver: Address,
    dexMap: DexMap
   ): [EncodeContractMethod, RouterParam];
}

export type RouterMap = {[contractMethod: string]: IRouter<any>};