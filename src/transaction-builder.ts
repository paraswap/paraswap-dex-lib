import { JsonRpcProvider } from '@ethersproject/providers';
import { IDex, DexMap } from './dex/idex';
import { IRouter, RouterMap } from './router/irouter';
import { OptimalRate, Address, Adapters } from './types';
import { ETHER_ADDRESS } from './constants';
import { getRouterMap } from './router';
import { getDexMap } from './dex';

export class TransactionBuilder {
  routerMap: RouterMap;
  dexMap: DexMap;
  provider: JsonRpcProvider;

  constructor(
    augustusAddress: Address,
    protected network: number,
    providerURL: string,
    adapters: Adapters,
  ) {
    this.provider = new JsonRpcProvider(providerURL);
    this.dexMap = getDexMap(augustusAddress, network, this.provider);
    this.routerMap = getRouterMap(this.dexMap, adapters);
  }

  public build({
    priceRoute,
    minMaxAmount,
    userAddress,
    partner,
    feePercent,
    gasPrice,
    permit,
    deadline,
    beneficiary,
    onlyParams = false,
    ignoreGas = false,
  }: {
    priceRoute: OptimalRate;
    minMaxAmount: string;
    userAddress: Address;
    partner: Address;
    feePercent: string;
    gasPrice: string;
    permit?: string;
    deadline: string;
    beneficiary?: Address;
    onlyParams?: boolean;
    ignoreGas?: boolean;
  }) {
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
      permit || '0x',
      deadline,
    );

    if (onlyParams) return params;

    const value = (priceRoute.src.toLowerCase() === ETHER_ADDRESS.toLowerCase() ? BigInt(priceRoute.srcAmount) + BigInt(networkFee) : BigInt(networkFee)).toString();

    return {
      from: userAddress,
      to: priceRoute.contractAddress,
      chainId: priceRoute.network,
      value,
      data: encoder.apply(null, params),
    };
  }
}
