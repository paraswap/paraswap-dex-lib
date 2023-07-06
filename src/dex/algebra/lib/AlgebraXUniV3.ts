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
    observationIndex: Number(state.globalState.timepointIndex),
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
