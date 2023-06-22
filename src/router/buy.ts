import { IRouter } from './irouter';
import {
  PayloadEncoder,
  encodeFeePercent,
  encodeFeePercentForReferrer,
} from './payload-encoder';
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
import { NULL_ADDRESS, SwapSide } from '../constants';

type BuyParam = [ContractBuyData];

export class Buy extends PayloadEncoder implements IRouter<BuyParam> {
  static isBuy = true;
  paraswapInterface: Interface;
  contractMethodName: string;

  constructor(dexAdapterService: DexAdapterService) {
    super(dexAdapterService);
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
    referrerAddress: Address | undefined,
    partnerAddress: Address,
    partnerFeePercent: string,
    positiveSlippageToUser: boolean,
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

    const isPartnerTakeNoFeeNoPos =
      +partnerFeePercent === 0 && positiveSlippageToUser == true;
    const partner = isPartnerTakeNoFeeNoPos
      ? NULL_ADDRESS // nullify partner address to fallback default circuit contract without partner/referrer (no harm as no fee taken at all)
      : referrerAddress || partnerAddress;

    const buyData: ContractBuyData = {
      adapter,
      fromToken: priceRoute.srcToken,
      toToken: priceRoute.destToken,
      fromAmount: minMaxAmount,
      toAmount: priceRoute.destAmount,
      expectedAmount: priceRoute.srcAmount,
      beneficiary,
      route,
      partner,
      feePercent: referrerAddress
        ? encodeFeePercentForReferrer(SwapSide.BUY)
        : encodeFeePercent(
            partnerFeePercent,
            positiveSlippageToUser,
            SwapSide.BUY,
          ),
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
