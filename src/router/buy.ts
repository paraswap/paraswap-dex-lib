import { IRouter } from './irouter';
import { PayloadEncoder } from './payload-encoder';
import {
  Address,
  OptimalRate,
  ContractBuyData,
  TxInfo,
  Adapters,
} from '../types';
import IParaswapABI from '../abi/IParaswap.json';
import { Interface } from '@ethersproject/abi';
import { DexAdapterService } from '../dex';
import { uuidToBytes16 } from '../utils';

type BuyParam = [ContractBuyData];

export class Buy extends PayloadEncoder implements IRouter<BuyParam> {
  static isBuy = true;
  paraswapInterface: Interface;
  contractMethodName: string;

  constructor(dexAdapterService: DexAdapterService, adapters: Adapters) {
    super(dexAdapterService, adapters);
    this.paraswapInterface = new Interface(IParaswapABI);
    this.contractMethodName = 'buy';
  }

  getContractMethodName(): string {
    return this.contractMethodName;
  }

  build(
    priceRoute: OptimalRate,
    minMaxAmount: string,
    userAddress: Address,
    partnerAddress: Address,
    partnerFeePercent: string,
    beneficiary: Address,
    permit: string,
    deadline: string,
    uuid: string,
  ): TxInfo<BuyParam> {
    if (
      priceRoute.bestRoute.length !== 1 ||
      priceRoute.bestRoute[0].percent !== 100 ||
      priceRoute.bestRoute[0].swaps.length !== 1
    )
      throw new Error(`buy invalid bestRoute`);
    const swap = priceRoute.bestRoute[0].swaps[0];
    const { adapter, route, networkFee } = this.getAdapterAndRouteForBuy(
      swap.srcToken,
      swap.destToken,
      swap.swapExchanges,
      minMaxAmount,
      priceRoute.srcAmount,
    );
    const buyData: ContractBuyData = {
      adapter,
      fromToken: priceRoute.srcToken,
      toToken: priceRoute.destToken,
      fromAmount: minMaxAmount,
      toAmount: priceRoute.destAmount,
      beneficiary,
      route,
      partner: partnerAddress,
      feePercent: partnerFeePercent,
      permit,
      deadline,
      uuid: uuidToBytes16(uuid),
    };
    const encoder = (...params: any[]) =>
      this.paraswapInterface.encodeFunctionData('buy', params);

    return {
      encoder,
      params: [buyData],
      networkFee: networkFee.toString(),
    };
  }
}
