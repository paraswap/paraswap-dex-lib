import { IRouter } from './irouter';
import { PayloadEncoder } from './payload-encoder';
import {
  Address,
  OptimalRate,
  ContractSellData,
  TxInfo,
  Adapters,
} from '../types';
import IParaswapABI from '../abi/IParaswap.json';
import { Interface } from '@ethersproject/abi';
import { DexAdapterLocator } from '../dex';

type MultiSwapParam = [ContractSellData];

export class MultiSwap
  extends PayloadEncoder
  implements IRouter<MultiSwapParam>
{
  paraswapInterface: Interface;
  contractMethodName: string;

  constructor(dexAdapterLocator: DexAdapterLocator, adapters: Adapters) {
    super(dexAdapterLocator, adapters);
    this.paraswapInterface = new Interface(IParaswapABI);
    this.contractMethodName = 'multiSwap';
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
    network: number,
  ): TxInfo<MultiSwapParam> {
    if (
      priceRoute.bestRoute.length !== 1 ||
      priceRoute.bestRoute[0].percent !== 100
    )
      throw new Error(`Multiswap invalid bestRoute`);
    const { paths, networkFee } = this.getContractPathsWithNetworkFee(
      priceRoute.bestRoute[0].swaps,
      network,
    );
    const sellData: ContractSellData = {
      fromToken: priceRoute.src,
      fromAmount: priceRoute.srcAmount,
      toAmount: minMaxAmount,
      expectedAmount: priceRoute.destAmount,
      beneficiary,
      path: paths,
      partner,
      feePercent,
      permit,
      deadline,
    };
    const encoder = (...params: any[]) =>
      this.paraswapInterface.encodeFunctionData('multiSwap', params);

    return {
      encoder,
      params: [sellData],
      networkFee: networkFee.toString(),
    };
  }
}
