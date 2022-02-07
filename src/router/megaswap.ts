import { IRouter } from './irouter';
import { PayloadEncoder } from './payload-encoder';
import {
  Address,
  OptimalRate,
  ContractMegaSwapSellData,
  TxInfo,
  Adapters,
} from '../types';
import IParaswapABI from '../abi/IParaswap.json';
import { Interface } from '@ethersproject/abi';
import { DexAdapterService } from '../dex';
import { uuidToBytes16 } from '../utils';

type MegaSwapParam = [ContractMegaSwapSellData];

export class MegaSwap extends PayloadEncoder implements IRouter<MegaSwapParam> {
  static isBuy = false;
  paraswapInterface: Interface;
  contractMethodName: string;

  constructor(dexAdapterService: DexAdapterService, adapters: Adapters) {
    super(dexAdapterService, adapters);
    this.paraswapInterface = new Interface(IParaswapABI);
    this.contractMethodName = 'megaSwap';
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
  ): TxInfo<MegaSwapParam> {
    const { megaSwapPaths, networkFee } = this.getMegaSwapPathsWithNetworkFee(
      priceRoute.bestRoute,
    );
    const sellData: ContractMegaSwapSellData = {
      fromToken: priceRoute.srcToken,
      fromAmount: priceRoute.srcAmount,
      toAmount: minMaxAmount,
      expectedAmount: priceRoute.destAmount,
      beneficiary,
      path: megaSwapPaths,
      partner: partnerAddress,
      feePercent: partnerFeePercent,
      permit,
      deadline,
      uuid: uuidToBytes16(uuid),
    };
    const encoder = (...params: any[]) =>
      this.paraswapInterface.encodeFunctionData('megaSwap', params);
    // TODO: fix network fee
    return {
      encoder,
      params: [sellData],
      networkFee: networkFee.toString(),
    };
  }
}
