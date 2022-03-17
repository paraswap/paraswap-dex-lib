import { getAddress } from '@ethersproject/address';
import { Interface, Result } from '@ethersproject/abi';

export const isSameAddress = (address1: string, address2: string): boolean =>
  getAddress(address1) === getAddress(address2);

export function getTokenScalingFactor(tokenDecimals: number): bigint {
  return BigInt(1e18) * BigInt(10) ** BigInt(18 - tokenDecimals);
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
