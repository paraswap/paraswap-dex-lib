import { BytesLike } from 'ethers';
import { defaultAbiCoder } from '@ethersproject/abi';
import { extractSuccessAndValue } from '../../lib/decoders';
import { MultiResult } from '../../lib/multi-wrapper';

export const decodeATokenFromReserveData = (
  result: MultiResult<BytesLike> | BytesLike,
): string => {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  if (!isSuccess || toDecode === '0x') {
    return 'error';
  }

  const decoded = defaultAbiCoder.decode(
    [
      'tuple(uint256) configuration',
      'uint128 liquidityIndex',
      'uint128 currentLiquidityRate',
      'uint128 variableBorrowIndex',
      'uint128 currentVariableBorrowRate',
      'uint128 currentStableBorrowRate',
      'uint40 lastUpdateTimestamp',
      'uint16 id',
      'address aTokenAddress',
      'address stableDebtTokenAddress',
      'address variableDebtTokenAddress',
      'address interestRateStrategyAddress',
      'uint128 accruedToTreasury',
      'uint128 unbacked',
      'uint128 isolationModeTotalDebt',
    ],
    toDecode,
  );

  return decoded.aTokenAddress;
};
