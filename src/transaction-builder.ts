import { JsonRpcProvider } from '@ethersproject/providers';
import { RouterMap } from './router/irouter';
import { OptimalRate, Address, Adapters } from './types';
import { ETHER_ADDRESS } from './constants';
import { getRouterMap } from './router';
import { buildDexAdapterLocator, DexAdapterLocator } from './dex';

export class TransactionBuilder {
  routerMap: RouterMap;
  dexAdapterLocator: DexAdapterLocator;
  provider: JsonRpcProvider;

  constructor(
    augustusAddress: Address,
    protected network: number,
    providerURL: string,
    adapters: Adapters,
  ) {
    this.provider = new JsonRpcProvider(providerURL);
    this.dexAdapterLocator = buildDexAdapterLocator(
      augustusAddress,
      this.provider,
    );
    this.routerMap = getRouterMap(this.dexAdapterLocator, adapters);
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
      this.network,
    );

    if (onlyParams) return params;

    const value = (
      priceRoute.src.toLowerCase() === ETHER_ADDRESS.toLowerCase()
        ? BigInt(priceRoute.srcAmount) + BigInt(networkFee)
        : BigInt(networkFee)
    ).toString();

    return {
      from: userAddress,
      to: priceRoute.contractAddress,
      value,
      data: encoder.apply(null, params),
      gasPrice,
    };
  }
}
