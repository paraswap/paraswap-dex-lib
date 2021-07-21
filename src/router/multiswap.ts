import { IRouter } from './irouter';
import { DexMap } from '../dex/idex';
import { PayloadEncoder } from './payload-encoder';
import { Address, OptimalRate, ContractSellData, TxInfo } from '../types';
import IParaswapABI from '../abi/IParaswap.json';
import { Interface } from '@ethersproject/abi';

type MultiSwapParam = [ContractSellData];

export class MultiSwap
  extends PayloadEncoder
  implements IRouter<MultiSwapParam>
{
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
  ): TxInfo<MultiSwapParam> {
    if (
      priceRoute.bestRoute.length !== 1 ||
      priceRoute.bestRoute[0].percent !== 100
    )
      throw new Error(`Multiswap invalid bestRoute`);
    const sellData: ContractSellData = {
      fromToken: priceRoute.src,
      fromAmount: priceRoute.srcAmount,
      toAmount: minMaxAmount,
      expectedAmount: priceRoute.destAmount,
      beneficiary,
      path: this.getContractPaths(priceRoute.bestRoute[0].swaps),
      partner,
      feePercent,
      permit,
      deadline,
    };
    const encoder = (...params: any[]) =>
      this.paraswapInterface.encodeFunctionData('multiSwap', params);
    // TODO: fix network fee
    return {
      encoder,
      params: [sellData],
      networkFee: '0',
    };
  }
}
