/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { readFileSync } from 'fs';
import { ksElasticMath } from './contract-math/kyberswap-elastic-math';
import { Address, Logger } from '../../types';
import { Tokens } from '../../../tests/constants-e2e';
import { KyberswapElasticEventPool } from './kyberswap-elastic-pool';
import { LinkedlistData, PoolState, TickInfo } from './types';
import { NumberAsString } from '../../types';
import { bigIntify } from '../../utils';
import _ from 'lodash';

describe('KyberswapElastic', function () {
  const dexKey = 'KyberswapElastic';

  describe('kyberswap-elastic-pool', () => {
    const network = Network.POLYGON;
    const dexHelper = new DummyDexHelper(network);

    const tokens = Tokens[network];

    const srcTokenSymbol = 'WETH';
    const destTokenSymbol = 'USDT';

    let logger: Logger = dexHelper.getLogger(dexKey + ' Test - ' + network);

    beforeAll(async () => {});

    it('computePoolAddress', async function () {
      const fee = 2000n;
      const poollAddress: Address =
        '0xc270E8bFddD1baeCB63f1F168cF16a5aF43F25F0';

      const pool = new KyberswapElasticEventPool(
        dexKey,
        network,
        dexHelper,
        logger,
        undefined,
        fee,
        tokens[srcTokenSymbol].address,
        tokens[destTokenSymbol].address,
      );

      const poolAddress = pool.computePoolAddress(
        tokens[srcTokenSymbol].address,
        tokens[destTokenSymbol].address,
        fee,
      );
      expect(poolAddress).toEqual(poollAddress);
    });

    it('generateState', async function () {
      const fee = 2000n;

      const pool = new KyberswapElasticEventPool(
        dexKey,
        network,
        dexHelper,
        logger,
        undefined,
        fee,
        tokens[srcTokenSymbol].address,
        tokens[destTokenSymbol].address,
      );

      const poolState = await pool.generateState(45055522);
      console.log('poolState :>> ', poolState);
    });
  });
});

describe('KSElasticMath', function () {
  let mockState: PoolState;
  type QuoteResult = {
    usedAmount: bigint;
    returnedAmount: bigint;
    initializedTicksCrossed: number;
  };
  let queries: {
    exactTokenIn0: QuoteResult;
    exactTokenIn1: QuoteResult;
    exactTokenOut0: QuoteResult;
    exactTokenOut1: QuoteResult;
  };
  beforeAll(() => {
    // ethereum, block 17731857, pool 0xf138462c76568cdfd77c6eb831e973d6963f2006
    const tickStates = JSON.parse(
      readFileSync(
        'src/dex/kyberswap-elastic/tick-states-0xf138462c76568cdfd77c6eb831e973d6963f2006-17731857.json',
        'utf-8',
      ),
    );

    queries = tickStates.queries;

    let ticks: Record<NumberAsString, TickInfo> = {};
    for (const k of Object.keys(tickStates.ticks)) {
      ticks[Number(k)] = {
        feeGrowthOutside: bigIntify(tickStates.ticks[k].feeGrowthOutside),
        liquidityGross: bigIntify(tickStates.ticks[k].liquidityGross),
        liquidityNet: bigIntify(tickStates.ticks[k].liquidityNet),
        secondsPerLiquidityOutside: bigIntify(
          tickStates.ticks[k].secondsPerLiquidityOutside,
        ),
      };
    }

    let initializedTicks: Record<NumberAsString, LinkedlistData> = {};
    for (const k of Object.keys(tickStates.initialized)) {
      initializedTicks[Number(k)] = {
        next: tickStates.initialized[k].next,
        previous: tickStates.initialized[k].previous,
      };
    }

    mockState = {
      poolData: {
        baseL: 2261342621265719n,
        sqrtP: 3454778945562389323500663n,
        nearestCurrentTick: -205440n,
        currentTick: -200817n,
        reinvestL: 1394017088509n,
        reinvestLLast: 1390743530931n,
        feeGrowthGlobal: 40925750265702722835232144n,
        secondsPerLiquidityGlobal: 114027209703366548185n,
        rTokenSupply: 1389888297175n,
        secondsPerLiquidityUpdateTime: 1689668195n,
        locked: false,
      },
      balance0: 7670933715363360804n,
      balance1: 20455369261n,
      blockTimestamp: 1689825623n,
      pool: '0xf138462c76568cdfd77c6eb831e973d6963f2006',
      isValid: true,
      swapFeeUnits: 300n,
      governmentFeeUnits: 16000n,
      tickDistance: 60n,
      maxTickLiquidity: 11506132647627593949529133949812950n,
      reinvestLiquidity: 1394017088509n,
      currentTick: -200817n,
      ticks: ticks,
      initializedTicks: initializedTicks,
    };
  });

  it('queryOutput, exact input token 1 - SELL', function () {
    let q = queries.exactTokenIn1;
    let result = ksElasticMath.queryOutputs(
      mockState,
      [bigIntify(q.usedAmount)],
      false,
      SwapSide.SELL,
    );
    expect(result.outputs[0]).toEqual(bigIntify(q.returnedAmount));
    expect(result.tickCounts[0]).toEqual(Number(q.initializedTicksCrossed));
  });
  it('queryOutput, exact input token 0 - SELL', function () {
    let q = queries.exactTokenIn0;
    let result = ksElasticMath.queryOutputs(
      mockState,
      [bigIntify(q.usedAmount)],
      true,
      SwapSide.SELL,
    );
    expect(result.outputs[0]).toEqual(bigIntify(q.returnedAmount));
    expect(result.tickCounts[0]).toEqual(Number(q.initializedTicksCrossed));
  });
  it('queryOutput, exact output token 0 - BUY', function () {
    let q = queries.exactTokenOut0;
    let result = ksElasticMath.queryOutputs(
      mockState,
      [bigIntify(q.usedAmount)],
      true,
      SwapSide.BUY,
    );
    expect(result.outputs[0]).toEqual(bigIntify(q.returnedAmount));
    expect(result.tickCounts[0]).toEqual(Number(q.initializedTicksCrossed));
  });
  it('queryOutput, exact output token 1 - BUY', function () {
    let q = queries.exactTokenOut1;
    let result = ksElasticMath.queryOutputs(
      mockState,
      [bigIntify(q.usedAmount)],
      false,
      SwapSide.BUY,
    );
    expect(result.outputs[0]).toEqual(bigIntify(q.returnedAmount));
    expect(result.tickCounts[0]).toEqual(Number(q.initializedTicksCrossed));
  });
});
