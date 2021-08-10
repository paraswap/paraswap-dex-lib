import { IRouter } from './irouter';
import { IDex } from '../dex/idex';
import { Address, OptimalRate, TxInfo, Adapters } from '../types';
import { SwapSide } from '../constants';
import { DexAdapterService } from '../dex';

export class DirectSwap<DexDirectReturn> implements IRouter<DexDirectReturn> {
  // This is just psuedo name as the DirectSwap
  // is more generic and works with multiple
  // contract methods.
  contractMethodName: string = 'directSwap';

  constructor(private dexAdapterService: DexAdapterService) {}

  getContractMethodName(): string {
    return this.contractMethodName;
  }

  build(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    userAddress: Address,
    partner: Address,
    feePercent: string,
    beneficiary: Address,
    permit: string,
    deadline: string,
  ): TxInfo<DexDirectReturn> {
    // TODO: add checks for src and dest amounts
    if (
      priceRoute.bestRoute.length !== 1 ||
      priceRoute.bestRoute[0].percent !== 100 ||
      priceRoute.bestRoute[0].swaps.length !== 1 ||
      priceRoute.bestRoute[0].swaps[0].swapExchanges.length !== 1 ||
      priceRoute.bestRoute[0].swaps[0].swapExchanges[0].percent !== 100
    )
      throw `DirectSwap invalid bestRoute`;

    const dexName = priceRoute.bestRoute[0].swaps[0].swapExchanges[0].exchange;
    if (!dexName) throw `Invalid dex name`;

    const dex = this.dexAdapterService.getDexByKey(dexName);
    if (!dex) throw `Failed to find dex : ${dexName}`;

    if (!dex.getDirectParam)
      throw `Invalid DEX: dex should have getDirectParam : ${dexName}`;

    const swapExchange = priceRoute.bestRoute[0].swaps[0].swapExchanges[0];
    const srcAmount =
      priceRoute.side === SwapSide.SELL ? swapExchange.srcAmount : minMaxAmount;
    const destAmount =
      priceRoute.side === SwapSide.BUY ? minMaxAmount : swapExchange.destAmount;

    return dex.getDirectParam!(
      priceRoute.src,
      priceRoute.dest,
      srcAmount,
      destAmount,
      swapExchange.data,
      priceRoute.side,
    );
  }
}
