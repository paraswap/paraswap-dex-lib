import { BytesLike, ethers } from 'ethers';
import { assert } from 'ts-essentials';

import { extractSuccessAndValue } from '../../../lib/decoders';
import { MultiResult } from '../../../lib/multi-wrapper';
import PoolABI from '../../../abi/kyberswap-elastic/IPool.json';

import {
  InitializedTicksResponse,
  KyberElasticStateResponses,
  LiquidityStateResponse,
  PoolStateResponse,
  SecondsPerLiquidityResponse,
  TicksResponse,
} from '../types';
import { ERR_DECODE } from '../errors';

export function decodePoolState(
  result: MultiResult<BytesLike> | BytesLike,
): KyberElasticStateResponses {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  assert(isSuccess && toDecode !== '0x', `${ERR_DECODE}: ${result}`);

  const callResults = new ethers.utils.Interface(PoolABI).decodeFunctionResult(
    'getPoolState',
    toDecode,
  );

  return <PoolStateResponse>{
    sqrtP: callResults.sqrtP,
    currentTick: callResults.currentTick,
    nearestCurrentTick: callResults.nearestCurrentTick,
    locked: callResults.locked,
  };
}

export function decodeLiquidityState(
  result: MultiResult<BytesLike> | BytesLike,
): KyberElasticStateResponses {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  assert(isSuccess && toDecode !== '0x', `${ERR_DECODE}: ${result}`);

  const callResults = new ethers.utils.Interface(PoolABI).decodeFunctionResult(
    'getLiquidityState',
    toDecode,
  );

  return <LiquidityStateResponse>{
    baseL: callResults.baseL,
    reinvestL: callResults.reinvestL,
    reinvestLLast: callResults.reinvestLLast,
  };
}

export function decodeSecondsPerLiquidity(
  result: MultiResult<BytesLike> | BytesLike,
): KyberElasticStateResponses {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  assert(isSuccess && toDecode !== '0x', `${ERR_DECODE}: ${result}`);

  const callResults = new ethers.utils.Interface(PoolABI).decodeFunctionResult(
    'getSecondsPerLiquidityData',
    toDecode,
  );

  return <SecondsPerLiquidityResponse>{
    secondsPerLiquidityGlobal: callResults.secondsPerLiquidityGlobal,
    lastUpdateTime: callResults.lastUpdateTime,
  };
}

export function decodeInitializedTicks(
  result: MultiResult<BytesLike> | BytesLike,
): KyberElasticStateResponses {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  assert(isSuccess && toDecode !== '0x', `${ERR_DECODE}: ${result}`);

  const callResults = new ethers.utils.Interface(PoolABI).decodeFunctionResult(
    'initializedTicks',
    toDecode,
  );

  return <InitializedTicksResponse>{
    previous: callResults.previous,
    next: callResults.next,
  };
}

export function decodeTicks(
  result: MultiResult<BytesLike> | BytesLike,
): KyberElasticStateResponses {
  const [isSuccess, toDecode] = extractSuccessAndValue(result);

  assert(isSuccess && toDecode !== '0x', `${ERR_DECODE}: ${result}`);

  const callResults = new ethers.utils.Interface(PoolABI).decodeFunctionResult(
    'ticks',
    toDecode,
  );

  return <TicksResponse>{
    liquidityGross: callResults.liquidityGross,
    liquidityNet: callResults.liquidityNet,
    feeGrowthOutside: callResults.feeGrowthOutside,
    secondsPerLiquidityOutside: callResults.secondsPerLiquidityOutside,
  };
}
