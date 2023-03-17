import { Token } from '../../types';
import { bigIntify } from '../nerve/utils';
import { getBigIntPow } from '../../utils';
import { JarvisSwapFunctions, PoolConfig } from './types';
import { BI_POWS } from '../../bigint-constants';

export const THIRTY_MINUTES = 60 * 30;
export const PRICE_UNIT = getBigIntPow(18);

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
      const syntheticAddress = pool.syntheticToken.address.toLowerCase();
      return (
        (srcAddress === collateralAddress &&
          destAddress === syntheticAddress) ||
        (srcAddress === syntheticAddress && destAddress === collateralAddress)
      );
    }) ?? null
  );
}
export function getJarvisPoolFromSyntheticTokens(
  srcToken: Token,
  poolConfigs: PoolConfig[],
): PoolConfig | null {
  return (
    poolConfigs.find(pool => {
      return (
        srcToken.address.toLowerCase() ===
        pool.syntheticToken.address.toLowerCase()
      );
    }) ?? null
  );
}

export function isSyntheticExchange(
  srcToken: Token,
  destToken: Token,
  poolConfigs: PoolConfig[],
): boolean {
  return (
    isSyntheticToken(srcToken, poolConfigs) &&
    isSyntheticToken(destToken, poolConfigs)
  );
}

export function isSyntheticToken(
  token: Token,
  poolConfigs: PoolConfig[],
): boolean {
  return poolConfigs.some(
    pool =>
      pool.syntheticToken.address.toLowerCase() === token.address.toLowerCase(),
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
  isReversePrice = false,
): bigint {
  const valueInWei: bigint = convertToNewDecimals(
    typeof amount === 'string' ? bigIntify(amount) : amount,
    8,
    18,
  );

  return isReversePrice ? getBigIntPow(36) / valueInWei : valueInWei;
}

export function inverseOf(number: string | bigint): bigint {
  return (
    getBigIntPow(36) / (typeof number === 'string' ? bigIntify(number) : number)
  );
}
