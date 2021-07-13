import { EncodeContractMethod, OptimalRate, Address } from '../types';

export interface IRouter<RouterParam> {
   build(
    priceRoute: OptimalRate,
    minMaxAmount: BigInt,
    userAddress: Address,
    referrer: string,
    referrerIndex: number,
    receiver: Address,
    dexMap: DexMap
   ): [EncodeContractMethod, RouterParam];
}