import { MIN_TICK } from './pools/math/tick';
import { addLiquidityCutoffsAndComputeTickIndex, Tick } from './types';

const nonZeroLiquidity = 1_000_000n;

const minTickUninitialized: Tick = {
  number: MIN_TICK,
  liquidityDelta: 0n,
};

const checkedTickNumberBounds: [number, number] = [-2, 2];
const [minCheckedTickNumber, maxCheckedTickNumber] = checkedTickNumberBounds;
const [betweenMinAndActiveTickNumber, betweenActiveAndMaxTickNumber] = [-1, 1];
const activeTickNumber = 0;

describe('addLiquidityCutoffsAndComputeTickIndex', () => {
  test('empty ticks', () => {
    const sortedTicks: Tick[] = [];

    expect(
      addLiquidityCutoffsAndComputeTickIndex(
        activeTickNumber,
        0n,
        sortedTicks,
        checkedTickNumberBounds,
      ),
    ).toStrictEqual(0);

    expect(sortedTicks).toStrictEqual([minTickUninitialized]);
  });

  test('initialized MIN_TICK', () => {
    const minTickInitialized = {
      number: MIN_TICK,
      liquidityDelta: nonZeroLiquidity,
    };
    const sortedTicks: Tick[] = [minTickInitialized];

    expect(
      addLiquidityCutoffsAndComputeTickIndex(
        activeTickNumber,
        nonZeroLiquidity,
        sortedTicks,
        checkedTickNumberBounds,
      ),
    ).toStrictEqual(0);

    expect(sortedTicks).toStrictEqual([
      minTickInitialized,
      {
        number: maxCheckedTickNumber,
        liquidityDelta: -nonZeroLiquidity,
      },
    ]);
  });

  describe('positive liquidity delta', () => {
    const liquidityDelta = 1_000_000n;

    test('initialized active tick', () => {
      const activeTickInitialized = {
        number: activeTickNumber,
        liquidityDelta: liquidityDelta,
      };
      const sortedTicks: Tick[] = [activeTickInitialized];

      expect(
        addLiquidityCutoffsAndComputeTickIndex(
          activeTickNumber,
          liquidityDelta,
          sortedTicks,
          checkedTickNumberBounds,
        ),
      ).toStrictEqual(1);

      expect(sortedTicks).toStrictEqual([
        minTickUninitialized,
        activeTickInitialized,
        {
          number: maxCheckedTickNumber,
          liquidityDelta: -liquidityDelta,
        },
      ]);
    });

    test('initialized minCheckedTick', () => {
      const minCheckedTickInitialized = {
        number: minCheckedTickNumber,
        liquidityDelta: liquidityDelta,
      };
      const sortedTicks: Tick[] = [minCheckedTickInitialized];

      expect(
        addLiquidityCutoffsAndComputeTickIndex(
          activeTickNumber,
          liquidityDelta,
          sortedTicks,
          checkedTickNumberBounds,
        ),
      ).toStrictEqual(1);

      expect(sortedTicks).toStrictEqual([
        minTickUninitialized,
        minCheckedTickInitialized,
        {
          number: maxCheckedTickNumber,
          liquidityDelta: -liquidityDelta,
        },
      ]);
    });

    test('initialized maxCheckedTick', () => {
      const maxCheckedTickInitialized = {
        number: maxCheckedTickNumber,
        liquidityDelta: liquidityDelta,
      };
      const sortedTicks: Tick[] = [maxCheckedTickInitialized];

      expect(
        addLiquidityCutoffsAndComputeTickIndex(
          activeTickNumber,
          0n,
          sortedTicks,
          checkedTickNumberBounds,
        ),
      ).toStrictEqual(0);

      expect(sortedTicks).toStrictEqual([
        minTickUninitialized,
        {
          number: maxCheckedTickNumber,
          liquidityDelta: 0n,
        },
      ]);
    });

    test('initialized minCheckedTick < tick < activeTick', () => {
      const tickInitialized = {
        number: betweenMinAndActiveTickNumber,
        liquidityDelta: liquidityDelta,
      };
      const sortedTicks: Tick[] = [tickInitialized];

      expect(
        addLiquidityCutoffsAndComputeTickIndex(
          activeTickNumber,
          liquidityDelta,
          sortedTicks,
          checkedTickNumberBounds,
        ),
      ).toStrictEqual(1);

      expect(sortedTicks).toStrictEqual([
        minTickUninitialized,
        tickInitialized,
        {
          number: maxCheckedTickNumber,
          liquidityDelta: -liquidityDelta,
        },
      ]);
    });

    test('initialized activeTick < tick < maxCheckedTick', () => {
      const tickInitialized = {
        number: betweenActiveAndMaxTickNumber,
        liquidityDelta: liquidityDelta,
      };
      const sortedTicks: Tick[] = [tickInitialized];

      expect(
        addLiquidityCutoffsAndComputeTickIndex(
          activeTickNumber,
          0n,
          sortedTicks,
          checkedTickNumberBounds,
        ),
      ).toStrictEqual(0);

      expect(sortedTicks).toStrictEqual([
        minTickUninitialized,
        tickInitialized,
        {
          number: maxCheckedTickNumber,
          liquidityDelta: -liquidityDelta,
        },
      ]);
    });
  });

  describe('negative liquidity delta', () => {
    const liquidityDelta = -1_000_000n;

    test('initialized active tick', () => {
      const activeTickInitialized = {
        number: activeTickNumber,
        liquidityDelta: liquidityDelta,
      };
      const sortedTicks: Tick[] = [activeTickInitialized];

      expect(
        addLiquidityCutoffsAndComputeTickIndex(
          activeTickNumber,
          0n,
          sortedTicks,
          checkedTickNumberBounds,
        ),
      ).toStrictEqual(2);

      expect(sortedTicks).toStrictEqual([
        minTickUninitialized,
        {
          number: minCheckedTickNumber,
          liquidityDelta: -liquidityDelta,
        },
        activeTickInitialized,
      ]);
    });

    test('initialized minCheckedTick', () => {
      const minCheckedTickInitialized = {
        number: minCheckedTickNumber,
        liquidityDelta: liquidityDelta,
      };
      const sortedTicks: Tick[] = [minCheckedTickInitialized];

      expect(
        addLiquidityCutoffsAndComputeTickIndex(
          activeTickNumber,
          0n,
          sortedTicks,
          checkedTickNumberBounds,
        ),
      ).toStrictEqual(1);

      expect(sortedTicks).toStrictEqual([
        minTickUninitialized,
        {
          number: minCheckedTickNumber,
          liquidityDelta: 0n,
        },
      ]);
    });

    test('initialized maxCheckedTick', () => {
      const maxCheckedTickInitialized = {
        number: maxCheckedTickNumber,
        liquidityDelta: liquidityDelta,
      };
      const sortedTicks: Tick[] = [maxCheckedTickInitialized];

      expect(
        addLiquidityCutoffsAndComputeTickIndex(
          activeTickNumber,
          -liquidityDelta,
          sortedTicks,
          checkedTickNumberBounds,
        ),
      ).toStrictEqual(1);

      expect(sortedTicks).toStrictEqual([
        minTickUninitialized,
        {
          number: minCheckedTickNumber,
          liquidityDelta: -liquidityDelta,
        },
        maxCheckedTickInitialized,
      ]);
    });

    test('initialized minCheckedTick < tick < activeTick', () => {
      const tickInitialized = {
        number: betweenMinAndActiveTickNumber,
        liquidityDelta: liquidityDelta,
      };
      const sortedTicks: Tick[] = [tickInitialized];

      expect(
        addLiquidityCutoffsAndComputeTickIndex(
          activeTickNumber,
          0n,
          sortedTicks,
          checkedTickNumberBounds,
        ),
      ).toStrictEqual(2);

      expect(sortedTicks).toStrictEqual([
        minTickUninitialized,
        {
          number: minCheckedTickNumber,
          liquidityDelta: -liquidityDelta,
        },
        tickInitialized,
      ]);
    });

    test('initialized activeTick < tick < maxCheckedTick', () => {
      const tickInitialized = {
        number: betweenActiveAndMaxTickNumber,
        liquidityDelta: liquidityDelta,
      };
      const sortedTicks: Tick[] = [tickInitialized];

      expect(
        addLiquidityCutoffsAndComputeTickIndex(
          activeTickNumber,
          -liquidityDelta,
          sortedTicks,
          checkedTickNumberBounds,
        ),
      ).toStrictEqual(1);

      expect(sortedTicks).toStrictEqual([
        minTickUninitialized,
        {
          number: minCheckedTickNumber,
          liquidityDelta: -liquidityDelta,
        },
        tickInitialized,
      ]);
    });
  });
});
