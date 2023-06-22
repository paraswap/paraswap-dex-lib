import { IRouter } from './irouter';
import {
  PayloadEncoder,
  encodeFeePercent,
  encodeFeePercentForReferrer,
  encodePartnerAddressForFeeLogic,
} from './payload-encoder';
import {
  Address,
  OptimalRate,
  ContractSellData,
  TxInfo,
  Adapters,
} from '../types';
import IParaswapABI from '../abi/IParaswap.json';
import { Interface } from '@ethersproject/abi';
import { DexAdapterService } from '../dex';
import { uuidToBytes16 } from '../utils';
import { SwapSide } from '../constants';

type MultiSwapParam = [ContractSellData];

export class MultiSwap
  extends PayloadEncoder
  implements IRouter<MultiSwapParam>
{
  static isBuy = false;
  paraswapInterface: Interface;
  contractMethodName: string;

  constructor(dexAdapterService: DexAdapterService) {
    super(dexAdapterService);
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
    referrerAddress: Address | undefined,
    partnerAddress: Address,
    partnerFeePercent: string,
    positiveSlippageToUser: boolean,
    beneficiary: Address,
    permit: string,
    deadline: string,
    uuid: string,
  ): TxInfo<MultiSwapParam> {
    if (
      priceRoute.bestRoute.length !== 1 ||
      priceRoute.bestRoute[0].percent !== 100
    )
      throw new Error(`Multiswap invalid bestRoute`);
    const { paths, networkFee } = this.getContractPathsWithNetworkFee(
      priceRoute.bestRoute[0].swaps,
    );

    const partner = encodePartnerAddressForFeeLogic({
      partnerAddress,
      referrerAddress,
      partnerFeePercent,
      positiveSlippageToUser,
    });

    const sellData: ContractSellData = {
      fromToken: priceRoute.srcToken,
      fromAmount: priceRoute.srcAmount,
      toAmount: minMaxAmount,
      expectedAmount: priceRoute.destAmount,
      beneficiary,
      path: paths,
      partner,
      feePercent: referrerAddress
        ? encodeFeePercentForReferrer(SwapSide.SELL)
        : encodeFeePercent(
            partnerFeePercent,
            positiveSlippageToUser,
            SwapSide.SELL,
          ),
      permit,
      deadline,
      uuid: uuidToBytes16(uuid),
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
