import { Address } from '@paraswap/core';
import { BigNumber } from 'ethers';
import { CurveV1SwapType } from '../../dex/curve-v1/types';
import { CurveV2SwapType } from '../../dex/curve-v2/types';

export const packCurveData = (
  address: Address,
  approve: boolean,
  wrapFlag: number,
  swapType: CurveV2SwapType | CurveV1SwapType,
): BigNumber => {
  let packedData = BigNumber.from(address);

  packedData = packedData.or(BigNumber.from(approve ? 1 : 0).shl(160));
  packedData = packedData.or(BigNumber.from(wrapFlag).shl(161));
  packedData = packedData.or(BigNumber.from(swapType).shl(163));

  return packedData;
};
