import { BigNumber } from '@0x/utils';
import {
  SwaapV1PoolParameters,
  SwaapV1PoolLiquidities,
  SwaapV1PoolOracles,
} from './types';

export const defaultParametersState: SwaapV1PoolParameters = {
  swapFee: BigInt(10 ** 12),
  priceStatisticsLookbackInRound: 5,
  priceStatisticsLookbackStepInRound: 4,
  dynamicCoverageFeesZ: BigInt(6),
  dynamicCoverageFeesHorizon: BigInt(5),
  priceStatisticsLookbackInSec: BigInt(3600),
  maxPriceUnpegRatio: BigInt(1025000000000000000),
};

export const defaultLiquiditiesState: SwaapV1PoolLiquidities = {};

export const defaultOraclesState: SwaapV1PoolOracles = {};

export const protocolPrecision = new BigNumber(10).pow(new BigNumber(18));
