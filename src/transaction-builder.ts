import { JsonRpcProvider } from '@ethersproject/providers';
import { IDex, DexMap } from './dex/idex';
import { IRouter, RouterMap } from './router/irouter';
import { OptimalRate, Address, Adapters } from './types';
import { getRouterMap } from './router';
import { getDexMap } from './dex';


export class TransactionBuilder {
  routerMap: RouterMap;
  dexMap: DexMap;
  provider: JsonRpcProvider;

  constructor(augustusAddress: Address, protected network: number, providerURL: string, adapters: Adapters) {
    this.provider = new JsonRpcProvider(providerURL);
    this.dexMap = getDexMap(augustusAddress, network, this.provider);
    this.routerMap = getRouterMap(this.dexMap, adapters);
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
