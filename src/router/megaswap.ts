import { IRouter } from './irouter';
import {
  PayloadEncoder,
  encodeFeePercent,
  encodeFeePercentForReferrer,
} from './payload-encoder';
import {
  Address,
  OptimalRate,
  ContractMegaSwapSellData,
  TxInfo,
} from '../types';
import IParaswapABI from '../abi/IParaswap.json';
import { Interface } from '@ethersproject/abi';
import { DexAdapterService } from '../dex';
import { uuidToBytes16 } from '../utils';
import { NULL_ADDRESS, SwapSide } from '../constants';

type MegaSwapParam = [ContractMegaSwapSellData];

export class MegaSwap extends PayloadEncoder implements IRouter<MegaSwapParam> {
  static isBuy = false;
  paraswapInterface: Interface;
  contractMethodName: string;

  constructor(dexAdapterService: DexAdapterService) {
    super(dexAdapterService);
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
    referrerAddress: Address | undefined,
    partnerAddress: Address,
    partnerFeePercent: string,
    positiveSlippageToUser: boolean,
    beneficiary: Address,
    permit: string,
    deadline: string,
    uuid: string,
  ): TxInfo<MegaSwapParam> {
    const { megaSwapPaths, networkFee } = this.getMegaSwapPathsWithNetworkFee(
      priceRoute.bestRoute,
    );

    const isPartnerTakeNoFeeNoPos =
      +partnerFeePercent === 0 && positiveSlippageToUser == true;

    const feePercent = isPartnerTakeNoFeeNoPos
      ? '0'
      : referrerAddress
      ? encodeFeePercentForReferrer(SwapSide.SELL)
      : encodeFeePercent(
          partnerFeePercent,
          positiveSlippageToUser,
          SwapSide.SELL,
        );

    const partner = isPartnerTakeNoFeeNoPos
      ? NULL_ADDRESS
      : referrerAddress || partnerAddress;

    const sellData: ContractMegaSwapSellData = {
      fromToken: priceRoute.srcToken,
      fromAmount: priceRoute.srcAmount,
      toAmount: minMaxAmount,
      expectedAmount: priceRoute.destAmount,
      beneficiary,
      path: megaSwapPaths,
      partner,
      feePercent,
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
