import { BPS_MAX_VALUE, SwapSide } from '../constants';

export const applyTransferFee = (
  amounts: bigint[],
  side: SwapSide,
  tokenTransferFee: number,
  tokenTransfersCount: number,
) => {
  // Filter simple case, when we don't need to charge anything
  if (tokenTransferFee === 0 || tokenTransfersCount === 0) {
    return amounts;
  }
  const isSell = side === SwapSide.SELL;
  const transferFeeBI = BigInt(tokenTransferFee);
  return amounts.map(amount => {
    let resultAmount = amount;
    for (let i = 0; i < tokenTransfersCount; i++) {
      if (isSell) {
        resultAmount -= (resultAmount * transferFeeBI) / BPS_MAX_VALUE;
      } else {
        /*
         * In order to calculate how the amount should be increased to receive originally requested amount
         * after taking fee, we should solve next equation for a:
         * a - (a * f) = r
         * where a - original amount before taking fee
         * f - fee to apply
         * r - result amount with fee
         * But that equation should be modified to account our constrain (multiply first and divide later),
         * which forced by the fact that calculations can not include fractions:
         * a - ((a * tF) / BPS)) = r
         * where tF = transferFee and BPS = BPS_MAX_VALUE
         * (a * BPS - a * tF) / BPS = r
         * (a * (BPS - tF)) = r * BPS
         * a = (r * BPS) / (BPS - tF)
         */
        resultAmount =
          (resultAmount * BPS_MAX_VALUE) / (BPS_MAX_VALUE - transferFeeBI);
      }
    }
    return resultAmount;
  });
};

/* Temporary location:
    const inAmountsWithFee = applyTransferFee(
      amounts,
      side,
      isSell ? srcTokenTransferFee : destTokenTransferFee,
      isSell ? SRC_TOKEN_PARASWAP_TRANSFERS : DEST_TOKEN_PARASWAP_TRANSFERS,
    );
*/
