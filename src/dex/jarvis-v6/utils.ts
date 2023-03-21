import { Address, Token } from '../../types';
import { bigIntify } from '../nerve/utils';
import { getBigIntPow } from '../../utils';
import {
  ChainLink,
  JarvisSwapFunctions,
  JarvisV6SystemMaxVars,
  PoolConfig,
} from './types';
import JarvisV6PoolABI from '../../abi/jarvis/jarvis-v6-pool.json';
import chainlinkABI from '../../abi/chainlink.json';
import { Contract } from 'web3-eth-contract';
import { Interface } from '@ethersproject/abi';
export const THIRTY_MINUTES = 60 * 30;
export const PRICE_UNIT = getBigIntPow(18);

const poolInterface = new Interface(JarvisV6PoolABI);
const chainlinkInterface = new Interface(chainlinkABI);

export async function getOnChainState(
  multiContract: Contract,
  chainlinkProxies: ChainLink,
  poolConfigs: PoolConfig[],
  blockNumber: number | 'latest',
) {
  const maxPoolsLiquidity = await _getMaxPoolsLiquidity(
    multiContract,
    poolConfigs,
    blockNumber,
  );
  const chainlinkPriceFeeds = await _getChainLinkPricesFeed(
    multiContract,
    chainlinkProxies,
    blockNumber,
  );

  return { maxPoolsLiquidity, chainlinkPriceFeeds };
}

async function _getChainLinkPricesFeed(
  multiContract: Contract,
  chainlinkProxies: ChainLink,
  blockNumber: number | 'latest',
) {
  const callData = Object.values(chainlinkProxies).map(c => [
    {
      target: c.proxy,
      callData: chainlinkInterface.encodeFunctionData('lastestAnswer', []),
    },
  ]);
  const res = await multiContract.methods
    .aggregate(callData)
    .call({}, blockNumber);

  let i = 0;
  return Object.entries(chainlinkProxies).reduce(
    (acc: { [pair: string]: bigint }, [key, value]) => {
      const lastestAnswer = convertToNewDecimals(
        chainlinkInterface.decodeFunctionResult(
          'lastestAnswer',
          res.returnData[i++],
        )[0],
        8,
        18,
      );

      acc[key] = lastestAnswer;
      return acc;
    },
    {},
  );
}
async function _getMaxPoolsLiquidity(
  multiContract: Contract,
  poolConfigs: PoolConfig[],
  blockNumber: number | 'latest',
) {
  const callData = poolConfigs.map(p => [
    {
      target: p.address,
      callData: poolInterface.encodeFunctionData('maxTokensCapacity', []),
    },
    {
      target: p.address,
      callData: poolInterface.encodeFunctionData('totalSyntheticTokens', []),
    },
  ]);
  const res = await multiContract.methods
    .aggregate(callData)
    .call({}, blockNumber);
  let i = 0;
  return poolConfigs.reduce(
    (acc: { [poolAddress: string]: JarvisV6SystemMaxVars }, pool) => {
      const maxSyntheticAvailable = bigIntify(
        poolInterface.decodeFunctionResult(
          'maxTokensCapacity',
          res.returnData[i++],
        )[0],
      );
      const maxCollateralAvailable = bigIntify(
        poolInterface.decodeFunctionResult(
          'totalSyntheticTokens',
          res.returnData[i++],
        )[0],
      );
      acc[pool.address] = { maxCollateralAvailable, maxSyntheticAvailable };
      return acc;
    },
    {},
  );
}
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
  srcAddress: Address,
  pool: PoolConfig,
): JarvisSwapFunctions {
  if (srcAddress.toLowerCase() === pool.collateralToken.address.toLowerCase())
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

export function calculateTokenLiquidityInUSD(
  pool: PoolConfig,
  maxPoolsLiquidity: JarvisV6SystemMaxVars,
  chainlinkPriceFeeds: {
    [pair: string]: bigint;
  },
  isSynthetic: boolean,
): bigint {
  return (
    (isSynthetic
      ? maxPoolsLiquidity.maxSyntheticAvailable *
        (pool.priceFeed[0].isReversePrice
          ? inverseOf(chainlinkPriceFeeds[pool.priceFeed[0].pair])
          : chainlinkPriceFeeds[pool.priceFeed[0].pair])
      : pool.collateralToken.symbol === 'USDC'
      ? maxPoolsLiquidity.maxCollateralAvailable
      : maxPoolsLiquidity.maxCollateralAvailable *
        chainlinkPriceFeeds[pool.priceFeed[pool.priceFeed.length - 1].pair]) /
    getBigIntPow(18)
  );
}
