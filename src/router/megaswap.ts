import { IRouter } from './irouter';
import { DexMap } from '../dex/idex';
import { PayloadEncoder } from './payload-encoder';
import {
  Address,
  OptimalRate,
  ContractMegaSwapSellData,
  TxInfo,
} from '../types';
import * as IParaswapABI from '../abi/IParaswap.json';
import { Interface } from '@ethersproject/abi';

type MegaSwapParam = [ContractMegaSwapSellData];

export class MegaSwap extends PayloadEncoder implements IRouter<MegaSwapParam> {
  paraswapInterface: Interface;

  constructor(dexMap: DexMap) {
    super(dexMap);
    this.paraswapInterface = new Interface(IParaswapABI as any);
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
  ): TxInfo<MegaSwapParam> {
    const sellData: ContractMegaSwapSellData = {
      fromToken: priceRoute.src,
      fromAmount: priceRoute.srcAmount,
      toAmount: minMaxAmount,
      expectedAmount: priceRoute.destAmount,
      beneficiary,
      path: this.getMegaSwapPaths(priceRoute.bestRoute),
      partner,
      feePercent,
      permit,
      deadline,
    };
    const encoder = (...params: any[]) =>
      this.paraswapInterface.encodeFunctionData('megaSwap', params);
    // TODO: fix network fee
    return {
      encoder,
      params: [sellData],
      networkFee: '0',
    };
  }
}
