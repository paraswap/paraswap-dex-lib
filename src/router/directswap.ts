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

type MultiSwapParam = [ContractSellData];

export class DirectSwap<DexDirectReturn> implements IRouter<DexDirectReturn> {
  contractMethodName: string;

  constructor(
    private dex: IDex<any, DexDirectReturn>,
    protected side: SwapSide,
  ) {
    if (!dex.getDirectParam || !dex.getDirectFuctionName)
      throw new Error(
        `Invalid DEX: dex should have getDirectParam and getDirectFuctionName`,
      );
    const { sell: sellfunctionName, buy: buyFunctionName } =
      dex.getDirectFuctionName();
    const contractMethodName =
      side === SwapSide.SELL ? sellfunctionName : buyFunctionName;
    if (!contractMethodName)
      throw new Error(
        `Invalid DEX: dex.getDirectFuctionName().${side.toLowerCase()} is not defined`,
      );
    this.contractMethodName = contractMethodName;
  }

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
      priceRoute.side.toLowerCase() !== this.side.toLowerCase() ||
      priceRoute.bestRoute.length !== 1 ||
      priceRoute.bestRoute[0].percent !== 100 ||
      priceRoute.bestRoute[0].swaps.length !== 1 ||
      priceRoute.bestRoute[0].swaps[0].swapExchanges.length !== 1 ||
      priceRoute.bestRoute[0].swaps[0].swapExchanges[0].percent !== 100 ||
      !this.dex.getDEXKey().includes(priceRoute.bestRoute[0].swaps[0].swapExchanges[0].exchange.toLowerCase())
    )
      throw new Error(`DirectSwap invalid bestRoute`);

    const swapExchange = priceRoute.bestRoute[0].swaps[0].swapExchanges[0];
    const srcAmount =
      priceRoute.side === SwapSide.SELL ? swapExchange.srcAmount : minMaxAmount;
    const destAmount =
      priceRoute.side === SwapSide.BUY ? minMaxAmount : swapExchange.destAmount;

    return this.dex.getDirectParam!(
      priceRoute.src,
      priceRoute.dest,
      srcAmount,
      destAmount,
      swapExchange.data,
      priceRoute.side,
    );
  }
}
