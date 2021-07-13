import { IDex } from './dex/idex';
import { IRouter } from './router/irouter';
import { OptimalRate, Address, DexMap } from './types';

export class TransactionBuilder { 
  routerMap: {[contractMethod: string]: IRouter<any>};
  dexMap: DexMap;

  constructor() {
    this.routerMap = {
      // TODO: initialize all the router
    };

    this.dexMap = {
      // TODO: initialize all the dexs
    }
  }
  
  build(
    priceRoute: OptimalRate,
    minMaxAmount: BigInt,
    userAddress: Address,
    referrer: string,
    referrerIndex: number,
    gasPrice: BigInt,
    receiver?: Address,
    onlyParams: boolean = false,
    ignoreGas: boolean = false,
  ) {
    const _receiver = receiver || userAddress;
    const [contractMethod, routerParams] = this.routerMap[priceRoute.contractMethod.toLowerCase()].build(
      priceRoute,
      minMaxAmount,
      userAddress,
      referrer,
      referrerIndex,
      _receiver,
      this.dexMap
    );
    if (onlyParams)
      return routerParams;
    // TODO: contractMethod pass routerParams and encodeABI
  }
}