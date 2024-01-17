import { Address } from '@paraswap/core';
import { CurveV2SwapType } from './types';
import { BigNumber } from 'ethers';

export const packCurveV2Data = (
  address: Address,
  approve: boolean,
  wrapFlag: number,
  swapType: CurveV2SwapType,
): BigNumber => {
  let packedData = BigNumber.from(address);

  packedData = packedData.or(BigNumber.from(approve ? 1 : 0).shl(160));
  packedData = packedData.or(BigNumber.from(wrapFlag).shl(161));
  packedData = packedData.or(BigNumber.from(swapType).shl(163));

  return packedData;
};
