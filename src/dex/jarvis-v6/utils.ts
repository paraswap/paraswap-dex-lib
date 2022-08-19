import { ethers } from 'ethers';
import { IDexHelper } from '../../dex-helper';
import { Address, Token } from '../../types';
import { bigIntify } from '../nerve/utils';
import { JarvisSwapFunctions, PoolConfig, PoolState } from './types';
import SynthereumPriceFeedABI from './abis/SynthereumPriceFeed.json';
import { Interface } from '@ethersproject/abi';
import { BI_POWS } from '../../bigint-constants';

export const THIRTY_MINUTES = 60 * 30;

export async function getOnChainState(
  dexHelper: IDexHelper,
  priceFeedAddress: Address,
  poolConfigs: PoolConfig[],
  poolInterface: Interface,
  blockNumber: number | 'latest',
): Promise<PoolState[]> {
  const pricesFeedResults = await _getPricesFeedValue(
    dexHelper,
    poolConfigs,
    priceFeedAddress,
    blockNumber,
  );

  const multiContract = dexHelper.multiContract;
  const PoolCallData = poolConfigs
    .map(pool => [
      {
        target: pool.address,
        callData: poolInterface.encodeFunctionData('feePercentage', []),
      },
    ])
    .flat();
  const poolDataCalled = await multiContract.methods
    .aggregate(PoolCallData)
    .call({}, blockNumber);

  let i = 0;
  return poolConfigs.map((pool, index) => {
    return {
      priceFeed: {
        usdcPrice: bigIntify(pricesFeedResults[index]),
      },
      pool: {
        feesPercentage: bigIntify(
          poolInterface.decodeFunctionResult(
            'feePercentage',
            poolDataCalled.returnData[i++],
          )[0],
        ),
      },
    };
  });
}

async function _getPricesFeedValue(
  dexHelper: IDexHelper,
  poolConfigs: PoolConfig[],
  priceFeedAddress: Address,
  blockNumber: number | 'latest',
) {
  const pairList = poolConfigs.map(pool =>
    ethers.utils.formatBytes32String(pool.priceFeedPair),
  );

  const priceFeedContract = new dexHelper.web3Provider.eth.Contract(
    SynthereumPriceFeedABI as any,
    priceFeedAddress,
  );

  const pricesFeedValues = await priceFeedContract.methods
    .getLatestPrices(pairList)
    .call({}, blockNumber);

  return pricesFeedValues;
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
      const syntheticToken = pool.syntheticToken.address.toLowerCase();
      return (
        (srcAddress === collateralAddress && destAddress === syntheticToken) ||
        (srcAddress === syntheticToken && destAddress === collateralAddress)
      );
    }) ?? null
  );
}

export function convertToNewDecimals(
  amount: bigint,
  currentDecimal: number,
  desireDecimal: number,
): bigint {
  if (currentDecimal === desireDecimal) return amount;
  const isDecimalIncrease = currentDecimal < desireDecimal;
  const bigIntPow = getBigIntPow(
    isDecimalIncrease
      ? desireDecimal - currentDecimal
      : currentDecimal - desireDecimal,
  );

  return isDecimalIncrease ? amount * bigIntPow : amount / bigIntPow;
}

// This is needed in order to not modify existing logic and use this wrapper
// to be safe if we receive not cached decimals
export function getBigIntPow(decimals: number): bigint {
  const value = BI_POWS[decimals];
  // It is not accurate to create 10 ** 23 and more decimals from number type
  return value === undefined ? BigInt(`1${'0'.repeat(decimals)}`) : value;
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
