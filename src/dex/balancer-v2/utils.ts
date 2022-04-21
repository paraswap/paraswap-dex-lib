import { getAddress } from '@ethersproject/address';
import { Interface, Result } from '@ethersproject/abi';
import { getBigIntPow } from '../../utils';
import { BI_POWS } from '../../bigint-constants';

export const isSameAddress = (address1: string, address2: string): boolean =>
  getAddress(address1) === getAddress(address2);

export function getTokenScalingFactor(tokenDecimals: number): bigint {
  return BI_POWS[18] * getBigIntPow(18 - tokenDecimals);
}

export function decodeThrowError(
  contractInterface: Interface,
  functionName: string,
  resultEntry: { success: boolean; returnData: any },
  poolAddress: string,
): Result {
  if (!resultEntry.success)
    throw new Error(`Failed to execute ${functionName} for ${poolAddress}`);
  return contractInterface.decodeFunctionResult(
    functionName,
    resultEntry.returnData,
  );
}
