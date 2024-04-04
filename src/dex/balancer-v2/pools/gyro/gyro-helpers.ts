import { BigNumber } from 'ethers';
import { WeiPerEther } from '@ethersproject/constants';

export function _reduceFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
  const feeAmount = amountIn.mul(swapFee).div(WeiPerEther);
  return amountIn.sub(feeAmount);
}

export function _addFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
  return amountIn.mul(WeiPerEther).div(WeiPerEther.sub(swapFee));
}
