import { Oracle } from '../../uniswap-v3/contract-math/Oracle';
import { PoolState } from '../types';

import { PoolState as UniV3PoolState } from '../../uniswap-v3/types';
import { TICK_SPACING } from './Constants';

type MinUniV3PoolState = Pick<
  UniV3PoolState,
  | 'slot0'
  | 'liquidity'
  | 'blockTimestamp'
  | 'startTickBitmap'
  | 'tickBitmap'
  | 'tickSpacing'
  | 'fee'
  | 'observations'
  | 'ticks'
>;

// @FIXME NOT OPTIMIZED
export const transformAlgebraToMinUniv3PoolState = (
  state: PoolState,
): MinUniV3PoolState => {
  const { globalState, timepoints } = state;

  const observations = Object.entries(timepoints).reduce<
    UniV3PoolState['observations']
  >((acc, [key, value]) => {
    acc[parseInt(key)] = {
      ...value,
      secondsPerLiquidityCumulativeX128: value.secondsPerLiquidityCumulative,
    };
    return acc;
  }, {});

  const ticks = Object.entries(state.ticks).reduce<UniV3PoolState['ticks']>(
    (acc, [key, value]) => {
      acc[parseInt(key)] = {
        ...value,
        secondsPerLiquidityOutsideX128: value.outerSecondsPerLiquidity,
        tickCumulativeOutside: value.outerTickCumulative,
        liquidityGross: value.liquidityTotal,
        liquidityNet: value.liquidityDelta,
        secondsOutside: value.outerSecondsSpent,
      };
      return acc;
    },
    {},
  );

  const slot0: UniV3PoolState['slot0'] = {
    feeProtocol:
      globalState.communityFeeToken0 + (globalState.communityFeeToken1 << 4n),
    observationCardinality: 0,
    observationCardinalityNext: 0,
    observationIndex: state.globalState.timepointIndex,
    sqrtPriceX96: state.globalState.price,
    tick: globalState.tick,
  };

  return {
    ...state,
    fee: globalState.fee,
    tickSpacing: TICK_SPACING,
    slot0,
    observations,
    ticks,
    tickBitmap: state.tickTable,
  };
};

export const getSingleTimepoint = (
  state: PoolState,
  time: bigint,
  secondsAgo: bigint,
  tick: bigint,
  index: number,
  liquidity: bigint,
) => {
  const { timepoints } = state;

  let oldestIndex = 0;
  // check if we have overflow in the past
  let nextIndex = index + 1; // considering overflow
  if (timepoints[nextIndex].initialized) {
    oldestIndex = nextIndex;
  }

  const univ3LikeState = transformAlgebraToMinUniv3PoolState(state);

  return Oracle.observeSingle(
    univ3LikeState,
    time,
    secondsAgo,
    tick,
    index,
    liquidity,
    0, // FIXME
  );
};

// FIXME
export const _writeTimepoint = (
  state: PoolState,
  timepointIndex: number,
  blockTimestamp: bigint,
  tick: bigint,
  liquidity: bigint,
  volumePerLiquidityInBlock: bigint,
): number => {
  const { globalState } = state;
  const univ3LikeState = transformAlgebraToMinUniv3PoolState(state);

  const [newTimepointIndex] = Oracle.write(
    univ3LikeState,
    globalState.timepointIndex,
    BigInt.asUintN(32, state.blockTimestamp),
    globalState.tick,
    0n, // FIXME
    0, // FIXME
    0, // FIXME
  );
  return newTimepointIndex;
};
