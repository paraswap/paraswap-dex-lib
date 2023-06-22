import _ from 'lodash';
import {
  Address,
  OptimalRate,
  TxInfo,
  ContractSimpleBuyNFTData,
} from '../types';
import { NULL_ADDRESS, SwapSide } from '../constants';
import { uuidToBytes16 } from '../utils';
import { DexAdapterService } from '../dex';
import {
  encodeFeePercent,
  encodeFeePercentForReferrer,
} from './payload-encoder';
import { PartialContractSimpleData, SimpleRouterBase } from './simpleswap';
import { BI_ADDR_MASK } from '../bigint-constants';
import { AugustusRFQOrderData } from '../dex/augustus-rfq';

const AUGUSTUS_RFQ_TOKEN_TYPE_ERC20 = 0n;
const AUGUSTUS_RFQ_TOKEN_TYPE_ERC1155 = 1n;
const AUGUSTUS_RFQ_TOKEN_TYPE_ERC721 = 2n;

const SIMPLE_SWAP_NFT_TOKEN_BIT_ERC1155 = 1n << 160n;
const SIMPLE_SWAP_NFT_TOKEN_BIT_ERC721 = 0n;

type SimpleBuyNFTParam = [ContractSimpleBuyNFTData];

export class SimpleBuyNFT extends SimpleRouterBase<SimpleBuyNFTParam> {
  static isBuy = true;
  constructor(dexAdapterService: DexAdapterService) {
    super(dexAdapterService, SwapSide.BUY, 'simpleBuyNFT');
  }

  protected validateBestRoute(priceRoute: OptimalRate): boolean {
    return (
      priceRoute.bestRoute.length === 1 &&
      priceRoute.bestRoute[0].percent === 100 &&
      ((priceRoute.bestRoute[0].swaps.length === 1 &&
        !priceRoute.bestRoute[0].swaps[0].swapExchanges.find(
          se =>
            se.exchange.toLowerCase() !== 'augustusrfqorder' ||
            !se.data.makerAssetId ||
            !se.data.takerAssetId,
        )) ||
        (priceRoute.bestRoute[0].swaps.length === 2 &&
          !priceRoute.bestRoute[0].swaps[1].swapExchanges.find(
            se =>
              se.exchange.toLowerCase() !== 'augustusrfqorder' ||
              !se.data.makerAssetId ||
              !se.data.takerAssetId,
          )))
    );
  }

  async build(
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
  ): Promise<TxInfo<SimpleBuyNFTParam>> {
    if (!this.validateBestRoute(priceRoute))
      throw new Error(`${this.contractMethodName} invalid bestRoute`);

    const { partialContractSimpleData, networkFee } = await this.buildCalls(
      priceRoute,
      minMaxAmount,
    );

    const getTokenDetails = (data: AugustusRFQOrderData) => {
      const makerAsset = BigInt(data.makerAsset);
      const makerTokenAddress = makerAsset & BI_ADDR_MASK;
      const rfqTokenType = makerAsset >> 160n;

      let routerTokenBit: bigint;
      if (rfqTokenType === AUGUSTUS_RFQ_TOKEN_TYPE_ERC1155) {
        routerTokenBit = SIMPLE_SWAP_NFT_TOKEN_BIT_ERC1155;
      } else if (rfqTokenType === AUGUSTUS_RFQ_TOKEN_TYPE_ERC721) {
        routerTokenBit = SIMPLE_SWAP_NFT_TOKEN_BIT_ERC721;
      } else {
        // Includes ERC20 case
        throw new Error(`RFQ order token type ${rfqTokenType} invalid`);
      }

      return {
        toToken: (makerTokenAddress | routerTokenBit).toString(),
        toTokenID: data.makerAssetId!,
        toAmount: data.makerAmount,
      };
    };

    const isPartnerTakeNoFeeNoPos =
      +partnerFeePercent === 0 && positiveSlippageToUser == true;
    const partner = isPartnerTakeNoFeeNoPos
      ? NULL_ADDRESS // nullify partner address to fallback default circuit contract without partner/referrer (no harm as no fee taken at all)
      : referrerAddress || partnerAddress;

    const buyData: ContractSimpleBuyNFTData = {
      ...partialContractSimpleData,
      fromToken: priceRoute.srcToken,
      toTokenDetails: _.last(priceRoute.bestRoute[0].swaps)!.swapExchanges.map(
        se => getTokenDetails(se.data),
      ),
      fromAmount: minMaxAmount,
      expectedAmount: priceRoute.srcAmount,
      beneficiary,
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
      this.paraswapInterface.encodeFunctionData(
        this.contractMethodName,
        params,
      );
    // TODO: fix network fee
    return {
      encoder,
      params: [buyData],
      networkFee,
    };
  }
}
