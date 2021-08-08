import { IRouter } from './irouter';
import { IDex } from '../dex/idex';
import {
  Address,
  OptimalRate,
  ContractSellData,
  TxInfo,
  Adapters,
} from '../types';
import { SwapSide } from '../constants';
import { DexAdapterService } from '../dex';

type MultiSwapParam = [ContractSellData];

export class DirectSwap<DexDirectReturn> implements IRouter<DexDirectReturn> {
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
    network: number,
  ): TxInfo<DexDirectReturn> {
    // TODO: add checks for src and dest amounts
    if (
      priceRoute.bestRoute.length !== 1 ||
      priceRoute.bestRoute[0].percent !== 100 ||
      priceRoute.bestRoute[0].swaps.length !== 1 ||
      priceRoute.bestRoute[0].swaps[0].swapExchanges.length !== 1 ||
      priceRoute.bestRoute[0].swaps[0].swapExchanges[0].percent !== 100
    )
      throw new Error(`DirectSwap invalid bestRoute`);

    const dexName = priceRoute.bestRoute[0].swaps[0].swapExchanges[0].exchange;
    if (!dexName) throw `Invalid dex name : ${dexName}`;

    const dex = this.dexAdapterService.getDexByKey(dexName, network);
    if (!dex) throw `Failed to find dex : ${dexName}`;

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
