import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { OptimalRate, Address, Adapters } from './types';
import { ETHER_ADDRESS } from './constants';
import { RouterService } from './router';
import { DexAdapterService } from './dex';

export class TransactionBuilder {
  routerService: RouterService;
  dexAdapterService: DexAdapterService;

  constructor(
    augustusAddress: Address,
    protected network: number,
    private provider: StaticJsonRpcProvider,
    adapters: Adapters,
  ) {
    this.dexAdapterService = new DexAdapterService(
      augustusAddress,
      this.provider,
      network,
    );
    this.routerService = new RouterService(this.dexAdapterService, adapters);
  }

  public build({
    priceRoute,
    minMaxAmount,
    userAddress,
    partnerAddress,
    partnerFeePercent,
    gasPrice,
    permit,
    deadline,
    beneficiary,
    onlyParams = false,
  }: {
    priceRoute: OptimalRate;
    minMaxAmount: string;
    userAddress: Address;
    partnerAddress: Address;
    partnerFeePercent: string;
    gasPrice: string;
    permit?: string;
    deadline: string;
    beneficiary?: Address;
    onlyParams?: boolean;
  }) {
    const _beneficiary = beneficiary || userAddress;
    const { encoder, params, networkFee } = this.routerService
      .getRouterByContractMethod(priceRoute.contractMethod)
      .build(
        priceRoute,
        minMaxAmount,
        userAddress,
        partnerAddress,
        partnerFeePercent,
        _beneficiary,
        permit || '0x',
        deadline,
      );

    if (onlyParams) return params;

    const value = (
      priceRoute.srcToken.toLowerCase() === ETHER_ADDRESS.toLowerCase()
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
