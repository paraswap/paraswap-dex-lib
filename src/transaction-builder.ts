import { IDex, DexMap } from './dex/idex';
import { IRouter, RouterMap } from './router/irouter';
import { OptimalRate, Address } from './types';
import { getRouterMap } from './router';
import { getDexMap } from './dex';

export class TransactionBuilder {
  routerMap: RouterMap;
  dexMap: DexMap;

  constructor(augustusAddress: Address) {
    this.dexMap = getDexMap(augustusAddress);
    this.routerMap = getRouterMap(this.dexMap);
  }

  public build(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    userAddress: Address,
    partner: Address,
    feePercent: string,
    gasPrice: string,
    permit: string,
    deadline: string,
    beneficiary?: Address,
    onlyParams: boolean = false,
    ignoreGas: boolean = false,
  ) {
    const _beneficiary = beneficiary || userAddress;
    const { encoder, params, networkFee } = this.routerMap[
      priceRoute.contractMethod.toLowerCase()
    ].build(
      priceRoute,
      minMaxAmount,
      userAddress,
      partner,
      feePercent,
      _beneficiary,
      permit,
      deadline,
    );

    if (onlyParams) return params;

    return {
      from: userAddress,
      to: priceRoute.contractAddress,
      chainId: priceRoute.network,
      networkFee,
      data: encoder.apply(null, params),
    };
  }
}
