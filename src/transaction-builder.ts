import { OptimalRate, Address, Adapters } from './types';
import { ETHER_ADDRESS, SwapSide } from './constants';
import { RouterService } from './router';
import { DexAdapterService } from './dex';
import {
  FRIENDLY_LOCAL_DEADLINE,
  getLocalDeadlineAsFriendlyPlaceholder,
} from './dex/simple-exchange';

export class TransactionBuilder {
  routerService: RouterService;

  constructor(protected dexAdapterService: DexAdapterService) {
    this.routerService = new RouterService(this.dexAdapterService);
  }

  public async build({
    priceRoute,
    minMaxAmount,
    userAddress,
    referrerAddress,
    partnerAddress,
    partnerFeePercent,
    positiveSlippageToUser,
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    permit,
    deadline,
    uuid,
    beneficiary,
    onlyParams = false,
  }: {
    priceRoute: OptimalRate;
    minMaxAmount: string;
    userAddress: Address;
    referrerAddress?: Address;
    partnerAddress: Address;
    partnerFeePercent: string;
    positiveSlippageToUser?: boolean;
    gasPrice?: string; // // @TODO: improve types? so that either gasPrice or ALL of max.*FeePerGas MUST be returned?
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    permit?: string;
    deadline: string;
    uuid: string;
    beneficiary?: Address;
    onlyParams?: boolean;
  }) {
    if (deadline) {
      const globalDeadline = +deadline;
      if (!isNaN(globalDeadline)) {
        const localDeadline = +getLocalDeadlineAsFriendlyPlaceholder();
        if (globalDeadline > localDeadline)
          throw new Error(
            `Deadline is too high. Maximum allowed is ${FRIENDLY_LOCAL_DEADLINE} seconds`,
          );
      }
    }

    const _beneficiary = beneficiary || userAddress;
    const { encoder, params, networkFee } = await this.routerService
      .getRouterByContractMethod(priceRoute.contractMethod)
      .build(
        priceRoute,
        minMaxAmount,
        userAddress,
        referrerAddress,
        partnerAddress,
        partnerFeePercent,
        positiveSlippageToUser ?? true,
        _beneficiary,
        permit || '0x',
        deadline,
        uuid,
      );

    if (onlyParams) return params;

    const value = (
      priceRoute.srcToken.toLowerCase() === ETHER_ADDRESS.toLowerCase()
        ? BigInt(
            priceRoute.side === SwapSide.SELL
              ? priceRoute.srcAmount
              : minMaxAmount,
          ) + BigInt(networkFee)
        : BigInt(networkFee)
    ).toString();

    return {
      from: userAddress,
      to: priceRoute.contractAddress,
      value,
      data: encoder.apply(null, params),
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  }
}
