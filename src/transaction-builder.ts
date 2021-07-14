import { IDex, DexMap } from './dex/idex';
import { IRouter, RouterMap } from './router/irouter';
import { OptimalRate, Address } from './types';
import { getRouterMap } from './router';
import { getDexMap } from './dex';

export class TransactionBuilder { 
  routerMap: RouterMap
  dexMap: DexMap;

  constructor() {
    this.routerMap = getRouterMap();
    this.dexMap = getDexMap();
  }
  
  public build(
    priceRoute: OptimalRate,
    minMaxAmount: BigInt,
    userAddress: Address,
    partner: Address,
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
      partner,
      _receiver,
      this.dexMap
    );
    if (onlyParams)
      return routerParams;
    // TODO: contractMethod pass routerParams and encodeABI
  }
}

