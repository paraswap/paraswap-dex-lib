import { BI_POWS } from '../../../bigint-constants';
import { _require } from '../../../utils';
import { TickData } from '../types';
import { Delta } from './maverick-delta-math';
import { MaverickBasicMath } from './maverick-basic-math';

export class MaverickSwapMath {
  static amountToBinNetOfProtocolFee(
    deltaInErc: bigint,
    feeBasis: bigint,
    protocolFeeD3: bigint,
  ): bigint {
    return protocolFeeD3 != 0n
      ? MaverickBasicMath.clip(
          deltaInErc,
          MaverickBasicMath.mulDivUp(feeBasis, protocolFeeD3, BI_POWS[3]),
        )
      : deltaInErc;
  }

  static remainingBinInputSpaceGivenOutput(
    binLiquidity: bigint,
    output: bigint,
    sqrtPrice: bigint,
    tokenAIn: boolean,
  ): bigint {
    let outOverL =
      binLiquidity === 0n ? 0n : MaverickBasicMath.divUp(output, binLiquidity);

    if (tokenAIn) {
      return MaverickBasicMath.mulDivUp(
        output,
        sqrtPrice,
        MaverickBasicMath.invFloor(sqrtPrice) - outOverL,
      );
    } else {
      return MaverickBasicMath.divUp(
        output,
        MaverickBasicMath.mulDown(sqrtPrice, sqrtPrice - outOverL),
      );
    }
  }

  static computeSwapExactIn(
    sqrtPrice: bigint,
    tickData: TickData,
    amountIn: bigint,
    tokenAIn: boolean,
    fee: bigint,
    protocolFeeD3: bigint,
  ): Delta {
    let delta: Delta = {
      deltaInBinInternal: 0n,
      deltaInErc: 0n,
      deltaOutErc: 0n,
      excess: 0n,
      tokenAIn: tokenAIn,
      exactOutput: false,
      swappedToMaxPrice: false,
      skipCombine: false,
      tickLimit: 0n,
      sqrtLowerTickPrice: 0n,
      sqrtUpperTickPrice: 0n,
      sqrtPrice: 0n,
      fractionalPart: 0n,
    };

    delta.deltaOutErc = tokenAIn
      ? tickData.currentReserveB
      : tickData.currentReserveA;

    let binAmountIn = this.remainingBinInputSpaceGivenOutput(
      tickData.currentLiquidity,
      delta.deltaOutErc,
      sqrtPrice,
      tokenAIn,
    );

    let feeBasis;
    let userBinAmountIn = MaverickBasicMath.mulDown(
      amountIn,
      BI_POWS[18] - fee,
    );

    if (userBinAmountIn < binAmountIn) {
      binAmountIn = userBinAmountIn;
      delta.deltaInErc = amountIn;
      feeBasis = delta.deltaInErc - userBinAmountIn;
    } else {
      feeBasis = MaverickBasicMath.mulDivUp(
        binAmountIn,
        fee,
        BI_POWS[18] - fee,
      );
      delta.deltaInErc = binAmountIn + feeBasis;
      delta.excess = MaverickBasicMath.clip(amountIn, delta.deltaInErc);
    }

    delta.deltaInBinInternal = this.amountToBinNetOfProtocolFee(
      delta.deltaInErc,
      feeBasis,
      protocolFeeD3,
    );

    if (delta.excess != 0n) return delta;

    let inOverL = MaverickBasicMath.divUp(
      binAmountIn,
      tickData.currentLiquidity + 1n,
    );

    delta.deltaOutErc = MaverickBasicMath.min(
      delta.deltaOutErc,
      MaverickBasicMath.mulDivDown(
        binAmountIn,
        tokenAIn ? MaverickBasicMath.invFloor(sqrtPrice) : sqrtPrice,
        inOverL + (tokenAIn ? sqrtPrice : MaverickBasicMath.invCeil(sqrtPrice)),
      ),
    );

    return delta;
  }

  static computeSwapExactOut(
    sqrtPrice: bigint,
    tickData: TickData,
    amountOut: bigint,
    tokenAIn: boolean,
    fee: bigint,
    protocolFeeD3: bigint,
  ): Delta {
    let delta: Delta = {
      deltaInBinInternal: 0n,
      deltaInErc: 0n,
      deltaOutErc: 0n,
      excess: 0n,
      tokenAIn: false,
      exactOutput: false,
      swappedToMaxPrice: false,
      skipCombine: false,
      tickLimit: 0n,
      sqrtLowerTickPrice: 0n,
      sqrtUpperTickPrice: 0n,
      sqrtPrice: 0n,
      fractionalPart: 0n,
    };

    let amountOutAvailable = tokenAIn
      ? tickData.currentReserveB
      : tickData.currentReserveA;
    let swapped = amountOutAvailable <= amountOut;
    delta.deltaOutErc = swapped ? amountOutAvailable : amountOut;
    let binAmountIn = this.remainingBinInputSpaceGivenOutput(
      tickData.currentLiquidity,
      delta.deltaOutErc,
      sqrtPrice,
      tokenAIn,
    );

    let feeBasis = MaverickBasicMath.mulDivUp(
      binAmountIn,
      fee,
      BI_POWS[18] - fee,
    );
    delta.deltaInErc = binAmountIn + feeBasis;
    delta.deltaInBinInternal = this.amountToBinNetOfProtocolFee(
      delta.deltaInErc,
      feeBasis,
      protocolFeeD3,
    );
    delta.excess = swapped
      ? MaverickBasicMath.clip(amountOut, delta.deltaOutErc)
      : 0n;

    return delta;
  }

  static computeEndPrice(delta: Delta, newDelta: Delta, tickData: TickData) {
    let endSqrtPrice =
      MaverickBasicMath.divDown(
        newDelta.deltaInBinInternal,
        tickData.currentLiquidity,
      ) +
      (delta.tokenAIn
        ? delta.sqrtPrice
        : MaverickBasicMath.invFloor(delta.sqrtPrice));
    if (!delta.tokenAIn) {
      endSqrtPrice = MaverickBasicMath.invFloor(endSqrtPrice);
    }

    newDelta.fractionalPart = MaverickBasicMath.min(
      BI_POWS[8],
      MaverickBasicMath.divDown(
        MaverickBasicMath.clip(endSqrtPrice, delta.sqrtLowerTickPrice),
        BI_POWS[10] * (delta.sqrtUpperTickPrice - delta.sqrtLowerTickPrice),
      ),
    );
  }
}
