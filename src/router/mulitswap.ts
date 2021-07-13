import { IRouter } from './irouter';
import { PayloadEncoder } from './payload-encoder';
import { Address, OptimalRate, DexMap, EncodeContractMethod } from '../types';

type MultiSwapParam = [];

export class MultiSwap extends PayloadEncoder implements IRouter<MultiSwapParam> {
  build( 
    priceRoute: OptimalRate,
    minMaxAmount: BigInt,
    userAddress: Address,
    referrer: string,
    referrerIndex: number,
    receiver: Address,
    dexMap: DexMap
  ): [EncodeContractMethod, MultiSwapParam] {
  }
}
