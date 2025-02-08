import { BigNumber } from 'ethers';
import { hexlify, hexZeroPad } from 'ethers/lib/utils';
import _ from 'lodash';
import { DeepReadonly, DeepWritable } from 'ts-essentials';
import { MIN_TICK } from './pools/math/tick';

export type Pool = {
  key: PoolKey;
  activeTick: number;
  liquidity: bigint;
  sqrtRatio: bigint;
  ticks: bigint[];
};

export interface Tick {
  readonly number: number;
  readonly liquidityDelta: bigint;
}

/**
 * Returns the index in the sorted tick array that has the greatest value of tick that is not greater than the given tick
 * @param sortedTicks the sorted list of ticks to search in
 * @param tick the tick to search for
 */
export function findNearestInitializedTickIndex(
  sortedTicks: Tick[],
  tick: number,
): number {
  let l = 0,
    r = sortedTicks.length;

  while (l < r) {
    const mid = Math.floor((l + r) / 2);
    const midTick = sortedTicks[mid].number;
    if (midTick <= tick) {
      // if it's the last index, or the next tick is greater, we've found our index
      if (
        mid === sortedTicks.length - 1 ||
        sortedTicks[mid + 1].number > tick
      ) {
        return mid;
      } else {
        // otherwise our value is to the right of this one
        l = mid;
      }
    } else {
      // the mid tick is greater than the one we want, so we know it's not mid
      r = mid;
    }
  }

  return -1;
}

export type PoolData = {
  tick: number;
  sqrtRatio: BigNumber;
  liquidity: BigNumber;
  minTick: number;
  maxTick: number;
  ticks: {
    number: number;
    liquidityDelta: BigNumber;
  }[];
};

export type GetQuoteDataResponse = PoolData[];

function addLiquidityCutoffsAndComputeTickIndex(
  activeTick: number,
  liquidity: bigint,
  sortedTicks: Tick[],
  [minCheckedTickNumber, maxCheckedTickNumber]: [number, number],
): number {
  // Such that every tick has a valid tick index in sortedTicks
  if (sortedTicks.at(0)?.number !== MIN_TICK) {
    sortedTicks.unshift({
      number: MIN_TICK,
      liquidityDelta: 0n,
    });
  }

  let activeTickIndex = null;
  let currentLiquidity = 0n;

  // The liquidity added/removed by out-of-range initialized ticks (i.e. lower/higher than minCheckedTickNumber/maxCheckedTickNumber)
  let liquidityDeltaMin = liquidity,
    liquidityDeltaMax;

  for (let i = 0; i < sortedTicks.length; i++) {
    const tick = sortedTicks[i];

    if (activeTickIndex === null && activeTick < tick.number) {
      // Might need to be corrected if we prepend ticks to the array (see below)
      activeTickIndex = i - 1; // Non-negative due to the first tick being the MIN_TICK

      liquidityDeltaMin -= currentLiquidity;

      // We now need to switch to tracking the liquidity that needs to be cut off at maxCheckedTickNumber, therefore reset to the actual liquidity
      currentLiquidity = liquidity;
    }

    currentLiquidity += tick.liquidityDelta;
  }

  activeTickIndex ??= sortedTicks.length - 1;

  if (liquidityDeltaMin !== 0n) {
    // minCheckedTickNumber > MIN_TICK (otherwise liquidityDeltaMin would be 0)
    sortedTicks.splice(1, 0, {
      number: minCheckedTickNumber,
      liquidityDelta: liquidityDeltaMin,
    });

    if (activeTickIndex !== 0 || activeTick >= minCheckedTickNumber) {
      activeTickIndex++;
    }
  }

  liquidityDeltaMax = -currentLiquidity;
  if (liquidityDeltaMax !== 0n) {
    // No modification of activeTickIndex required here

    sortedTicks.push({
      number: maxCheckedTickNumber,
      liquidityDelta: liquidityDeltaMax,
    });
  }

  return activeTickIndex;
}

export class PoolState {
  private constructor(
    public sqrtRatio: bigint,
    public liquidity: bigint,
    public activeTick: number,
    public readonly sortedTicks: Tick[],
    public activeTickIndex: number,
  ) {}

  public equals(other: DeepReadonly<PoolState>) {
    // Compare but special case low and high cutoff ticks
  }

  public static fromSwappedEvent(
    oldState: DeepReadonly<PoolState>,
    sqrtRatioAfter: BigNumber,
    liquidityAfter: BigNumber,
    tickAfter: number,
  ): PoolState {
    const sortedTicks = oldState.sortedTicks;

    const clonedTicks = _.cloneDeep(sortedTicks) as DeepWritable<
      typeof sortedTicks
    >;

    return new PoolState(
      sqrtRatioAfter.toBigInt(),
      liquidityAfter.toBigInt(),
      tickAfter,
      clonedTicks,
      findNearestInitializedTickIndex(clonedTicks, tickAfter),
    );
  }

  public static fromPositionUpdatedEvent(
    oldState: DeepReadonly<PoolState>,
    [lowTick, highTick]: [number, number],
    liquidityDelta: bigint,
  ): PoolState | null {
    if (liquidityDelta === 0n) {
      return null;
    }

    return null;
    /*return new PoolState(
      oldState.sqrtRatio,
    )*/
  }

  public static fromQuoter(data: PoolData): PoolState {
    const sortedTicks = data.ticks.map(({ number, liquidityDelta }) => ({
      number,
      liquidityDelta: liquidityDelta.toBigInt(),
    }));
    const liquidity = data.liquidity.toBigInt();

    //console.log(sortedTicks, liquidity, data.tick, data.minTick, data.maxTick);

    const activeTickIndex = addLiquidityCutoffsAndComputeTickIndex(
      data.tick,
      liquidity,
      sortedTicks,
      [data.minTick, data.maxTick],
    );

    //console.log(sortedTicks);

    return new PoolState(
      data.sqrtRatio.toBigInt(),
      liquidity,
      data.tick,
      sortedTicks,
      activeTickIndex,
    );
  }
}

export type EkuboData = {
  poolKey: PoolKey;
  isToken1: boolean;
};

export type DexParams = {
  apiUrl: string;
  core: string;
  oracle: string;
  dataFetcher: string;
  swapper: string;
  //enabledFeeTiers: bigint[],
  //api_url: Url,
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
};

export class PoolKey {
  constructor(
    public readonly token0: bigint,
    public readonly token1: bigint,
    public readonly fee: bigint,
    public readonly tickSpacing: number,
    public readonly extension: bigint,
  ) {}

  stringId(): string {
    return `${this.token0}_${this.token1}_${this.fee}_${this.tickSpacing}_${this.extension}`;
  }

  intId(): bigint {
    // TODO
    return 0n;
  }

  toAbi(): AbiPoolKey {
    return {
      token0: hexZeroPad(hexlify(this.token0), 20),
      token1: hexZeroPad(hexlify(this.token1), 20),
      fee: BigNumber.from(this.fee),
      tickSpacing: this.tickSpacing,
      extension: hexZeroPad(hexlify(this.extension), 20),
    };
  }
}

export type AbiPoolKey = {
  token0: string;
  token1: string;
  fee: BigNumber;
  tickSpacing: number;
  extension: string;
};

export type VanillaPoolParameters = {
  fee: bigint;
  tickSpacing: number;
};
