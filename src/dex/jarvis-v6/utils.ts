import { Token } from '../../types';
import { bigIntify } from '../nerve/utils';
import { getBigIntPow } from '../../utils';
import { JarvisSwapFunctions, PoolConfig } from './types';

export const THIRTY_MINUTES = 60 * 30;

export function getJarvisPoolFromTokens(
  srcToken: Token,
  destToken: Token,
  poolConfigs: PoolConfig[],
): PoolConfig | null {
  const srcAddress = srcToken.address.toLowerCase();
  const destAddress = destToken.address.toLowerCase();
  return (
    poolConfigs.find(pool => {
      const collateralAddress = pool.collateralToken.address.toLowerCase();
      const syntheticToken = pool.syntheticToken.address.toLowerCase();
      return (
        (srcAddress === collateralAddress && destAddress === syntheticToken) ||
        (srcAddress === syntheticToken && destAddress === collateralAddress)
      );
    }) ?? null
  );
}

export function convertToNewDecimals(
  amount: string | bigint,
  currentDecimal: number,
  desireDecimal: number,
): bigint {
  const value = typeof amount === 'string' ? bigIntify(amount) : amount;
  if (currentDecimal === desireDecimal) return value;
  const isDecimalIncrease = currentDecimal < desireDecimal;
  const bigIntPow = getBigIntPow(
    isDecimalIncrease
      ? desireDecimal - currentDecimal
      : currentDecimal - desireDecimal,
  );

  return isDecimalIncrease ? value * bigIntPow : value / bigIntPow;
}

export function getJarvisSwapFunction(
  srcToken: Token,
  pool: PoolConfig,
): JarvisSwapFunctions {
  const srcAddress = srcToken.address.toLowerCase();
  if (srcAddress === pool.collateralToken.address.toLowerCase())
    return JarvisSwapFunctions.MINT;
  return JarvisSwapFunctions.REDEEM;
}

export function calculateConvertedPrice(
  amount: string | bigint,
  isReversePrice: boolean,
): bigint {
  const valueInWei: bigint = convertToNewDecimals(
    typeof amount === 'string' ? bigIntify(amount) : amount,
    8,
    18,
  );
  return isReversePrice ? bigIntify(1) / valueInWei : valueInWei;
}
